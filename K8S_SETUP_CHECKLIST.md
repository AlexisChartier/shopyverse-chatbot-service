# Kubernetes Setup Checklist

Quick reference for setting up the complete CI/CD and Kubernetes infrastructure.

## Pre-requisites

- [ ] Kubernetes cluster (EKS, GKE, AKS, or local Kind/Minikube)
- [ ] `kubectl` configured and authenticated
- [ ] `helm` installed (v3+)
- [ ] GitHub repository with Actions enabled
- [ ] Container registry (GHCR, Docker Hub, ECR)
- [ ] Slack workspace (for notifications)

## Phase 1: GitHub Actions Setup

### 1. Configure GitHub Secrets

Go to **Repository > Settings > Secrets and variables > Actions**

```bash
# Generate kubeconfig for dev/staging/prod and base64-encode them
cat ~/.kube/config | base64 > kubeconfig.b64
# Copy content to K8S_DEV_KUBECONFIG_B64, etc.
```

Required secrets:
- `K8S_DEV_KUBECONFIG_B64`
- `K8S_DEV_CONTEXT`
- `K8S_STAGING_KUBECONFIG_B64`
- `K8S_STAGING_CONTEXT`
- `K8S_PROD_KUBECONFIG_B64`
- `K8S_PROD_CONTEXT`
- `HF_ACCESS_TOKEN`
- `PROD_API_KEY`
- `SLACK_WEBHOOK_DEV`
- `SLACK_WEBHOOK_STAGING`
- `SLACK_WEBHOOK_PROD`

### 2. Verify Workflows

- [ ] `.github/workflows/ci.yml` is present and enabled
- [ ] `.github/workflows/cd.yml` is present and enabled
- [ ] Make a test commit to trigger CI pipeline

## Phase 2: Kubernetes Infrastructure

### 1. Create Namespaces

```bash
kubectl create namespace chatbot-dev
kubectl create namespace chatbot-staging
kubectl create namespace chatbot-prod
kubectl create namespace monitoring
```

### 2. Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### 3. Install cert-manager (for TLS)

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

Create ClusterIssuer for Let's Encrypt:

```bash
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@shopyverse.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 4. Install Prometheus Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f - <<EOF
prometheus:
  prometheusSpec:
    retention: 15d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
grafana:
  adminPassword: <change-me>
  persistence:
    enabled: true
    size: 10Gi
EOF
```

### 5. Install Loki (Logging)

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki-stack grafana/loki-stack \
  --namespace monitoring \
  -f - <<EOF
loki:
  persistence:
    enabled: true
    size: 50Gi
promtail:
  enabled: true
EOF
```

### 6. Deploy External Services (PostgreSQL, Qdrant)

**PostgreSQL (if not managed):**
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami

# Dev
helm install postgres-dev bitnami/postgresql \
  --namespace chatbot-dev \
  --set auth.username=chatbot \
  --set auth.password=chatbot \
  --set auth.database=chatbot_db

# Staging
helm install postgres-staging bitnami/postgresql \
  --namespace chatbot-staging \
  --set auth.username=chatbot \
  --set auth.password=<change-me> \
  --set auth.database=chatbot_db

# Prod
helm install postgres-prod bitnami/postgresql \
  --namespace chatbot-prod \
  --set auth.username=chatbot \
  --set auth.password=<change-me> \
  --set auth.database=chatbot_db \
  --set primary.persistence.size=100Gi
```

**Qdrant (Vector DB):**
```bash
helm repo add qdrant https://qdrant.github.io/qdrant-helm

# Dev
helm install qdrant-dev qdrant/qdrant \
  --namespace chatbot-dev \
  --set persistence.size=10Gi

# Staging
helm install qdrant-staging qdrant/qdrant \
  --namespace chatbot-staging \
  --set persistence.size=50Gi

# Prod
helm install qdrant-prod qdrant/qdrant \
  --namespace chatbot-prod \
  --set persistence.size=100Gi \
  --set replicas=3
```

## Phase 3: Secrets Setup

### Create K8s Secrets for Each Environment

```bash
# Dev
kubectl create secret generic chatbot-service-secrets \
  --from-literal=hf-access-token=$HF_ACCESS_TOKEN \
  --from-literal=api-key=dev-api-key \
  --from-literal=db-password=chatbot \
  -n chatbot-dev

# Staging
kubectl create secret generic chatbot-service-secrets \
  --from-literal=hf-access-token=$HF_ACCESS_TOKEN \
  --from-literal=api-key=$STAGING_API_KEY \
  --from-literal=db-password=$STAGING_DB_PASSWORD \
  -n chatbot-staging

# Prod
kubectl create secret generic chatbot-service-secrets \
  --from-literal=hf-access-token=$HF_ACCESS_TOKEN \
  --from-literal=api-key=$PROD_API_KEY \
  --from-literal=db-password=$PROD_DB_PASSWORD \
  -n chatbot-prod
```

## Phase 4: First Deployment

### Test Manual Deployment to Dev

```bash
helm upgrade --install chatbot-service ./helm/chatbot-service \
  --namespace chatbot-dev \
  --values ./helm/values-dev.yaml \
  --set image.tag=main-latest \
  --wait --timeout 5m

# Verify
kubectl rollout status deployment/chatbot-service -n chatbot-dev
kubectl get pods -n chatbot-dev -l app=chatbot-service
```

### Test Ingress

```bash
# Get Ingress IP
kubectl get ingress -n chatbot-dev

# Add to /etc/hosts (or DNS)
<ingress-ip> chatbot.dev.local

# Test
curl -H "x-api-key: dev-api-key" http://chatbot.dev.local/metrics
```

## Phase 5: Configure Monitoring

### 1. Access Grafana

```bash
# Port-forward
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Open http://localhost:3000
# Username: admin
# Password: <value from helm install output>
```

### 2. Add Prometheus Data Source

- Go to **Configuration > Data Sources > Add data source**
- Select **Prometheus**
- URL: `http://kube-prometheus-stack-prometheus:9090`
- Save & test

### 3. Import Dashboards

- Go to **Dashboards > Import**
- Import by ID or JSON

## Phase 6: Configure Alerts

### 1. Set up AlertManager

```bash
# Port-forward AlertManager
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093

# Open http://localhost:9093
```

### 2. Configure Slack Integration

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-slack
  namespace: monitoring
type: Opaque
stringData:
  slack-api-url: $SLACK_WEBHOOK_PROD
EOF
```

## Phase 7: Trigger CD Pipeline

### Create Version Tag (Production)

```bash
# Ensure all changes are committed
git add -A
git commit -m "Ready for v1.0.0 release"

# Create tag
git tag -a v1.0.0 -m "Production release v1.0.0"

# Push tag (triggers CD pipeline)
git push origin v1.0.0
```

## Verification Checklist

- [ ] CI pipeline runs on push/PR
- [ ] Docker images built and pushed to registry
- [ ] SBOM generated and attached to release
- [ ] Dev deployment succeeds
- [ ] Staging deployment with canary succeeds
- [ ] Prod deployment with blue-green succeeds
- [ ] Health checks pass in all environments
- [ ] Metrics visible in Prometheus
- [ ] Logs visible in Loki/Grafana
- [ ] Alerts firing correctly (test with low thresholds)
- [ ] Slack notifications received
- [ ] Ingress routing works for all environments

## Common Commands

```bash
# View all resources
kubectl get all -n chatbot-prod

# Check pod logs
kubectl logs -f deployment/chatbot-service -n chatbot-prod

# Port-forward to test locally
kubectl port-forward svc/chatbot-service 3001:80 -n chatbot-prod

# Scale deployment
kubectl scale deployment/chatbot-service --replicas=5 -n chatbot-prod

# View deployment status
kubectl describe deployment chatbot-service -n chatbot-prod

# Trigger manual rollout
kubectl rollout restart deployment/chatbot-service -n chatbot-prod

# Get Helm release history
helm history chatbot-service -n chatbot-prod

# Rollback to previous Helm release
helm rollback chatbot-service -n chatbot-prod
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pod stuck in Pending | `kubectl describe pod <name>` - check resource requests |
| CrashLoopBackOff | `kubectl logs <name>` - view startup errors |
| Deployment not rolling | Check resource availability, rollback previous version |
| Ingress not working | Verify ingress-nginx installed, check ingress rules |
| Metrics not appearing | Verify Prometheus scrape config, check pod annotations |
| Logs not appearing | Verify Loki config, check pod labels for logging |

---

**Next: Start using the CI/CD pipeline!**

1. Make a commit to main → CI runs → Dev deploys
2. Create a tag v1.x.x → CD runs → Staging + Prod deploys
3. Monitor via Grafana dashboard
4. Set up on-call rotation with PagerDuty integration
