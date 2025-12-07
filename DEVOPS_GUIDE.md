# CI/CD & Kubernetes Deployment Guide

This guide covers the complete DevOps cycle for the ShopyVerse Chatbot Service, including CI/CD pipelines, Kubernetes deployment, and observability.

## Table of Contents

1. [CI/CD Overview](#cicd-overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Kubernetes & Helm Deployment](#kubernetes--helm-deployment)
4. [Secrets Management](#secrets-management)
5. [Observability & Monitoring](#observability--monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## CI/CD Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │   CI Pipeline       │    │    CD Pipeline               │   │
│  │  (on: push/PR)      │    │  (on: push main, tags)       │   │
│  ├─────────────────────┤    ├──────────────────────────────┤   │
│  │ • Lint & SCA        │    │ Deploy to Dev                │   │
│  │ • Unit Tests (>70%) │    │ → Deploy to Staging (Canary) │   │
│  │ • Build Docker      │    │ → Deploy to Prod (Blue-Green)│   │
│  │ • Generate SBOM     │    │ • Health checks              │   │
│  │ • Push to GHCR      │    │ • Slack notifications        │   │
│  └─────────────────────┘    └──────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
              ┌──────────────────────────────┐
              │   Container Registry (GHCR)  │
              │  (tagged images with SBOM)   │
              └──────────────────────────────┘
                              │
                              ↓
              ┌──────────────────────────────┐
              │   Kubernetes Clusters        │
              ├──────────────────────────────┤
              │ Dev   (1 replica)            │
              │ Staging (2 replicas, canary)│
              │ Prod  (3+ replicas, HPA)    │
              └──────────────────────────────┘
```

---

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** 
- Push to `main`, `feat/**`, `develop` branches
- Pull requests to `main`, `develop`

**Jobs:**

1. **Lint & Security Analysis**
   - ESLint (if configured)
   - TypeScript compiler check
   - npm audit (moderate+ severity)
   - Trivy filesystem scan
   - SARIF upload to GitHub Security tab

2. **Unit Tests**
   - PostgreSQL & Qdrant services running
   - Coverage enforced at **≥ 70%** (fails otherwise)
   - Coverage uploaded to Codecov

3. **Build Docker Image**
   - Conditional: only on main branch push (not on PR)
   - Multi-stage build with layer caching
   - Tags: semantic version, branch, SHA, latest
   - SBOM generated (CycloneDX JSON format)
   - Image scanned with Trivy

4. **E2E Smoke Tests** (on main push only)
   - Basic HTTP requests to running service
   - Non-critical (continues on failure)

### CD Workflow (`.github/workflows/cd.yml`)

**Triggers:**
- Push to `main` branch → Deploy to Dev + Staging
- Tag push `v*` → Deploy to Production

**Deployment Stages:**

| Environment | Condition | Replicas | Strategy | Duration |
|-------------|-----------|----------|----------|----------|
| **Dev** | main branch push | 1 | Rolling | ~5m |
| **Staging** | main branch push | 2 | Canary (2 steps) | ~10m |
| **Prod** | tag v* push | 3+ | Blue-Green | ~15m |

---

## Kubernetes & Helm Deployment

### Prerequisites

**Cluster Setup:**
```bash
# 1. Create namespaces
kubectl create namespace chatbot-dev
kubectl create namespace chatbot-staging
kubectl create namespace chatbot-prod

# 2. Install cert-manager (for TLS)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# 3. Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# 4. Install Prometheus Stack (monitoring)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f helm/prometheus-values.yaml

# 5. Install Loki (logging)
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  --namespace monitoring \
  -f helm/loki-values.yaml
```

### Helm Chart Structure

```
helm/
├── Chart.yaml                    # Chart metadata
├── values.yaml                   # Default values
├── values-dev.yaml              # Dev overrides
├── values-staging.yaml          # Staging overrides
├── values-prod.yaml             # Prod overrides
├── chatbot-service/             # Chart directory
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml      # K8s Deployment
│       ├── service.yaml         # K8s Service
│       ├── ingress.yaml         # K8s Ingress
│       ├── configmap.yaml       # ConfigMap
│       ├── secrets.yaml         # Secret template
│       ├── serviceaccount.yaml   # ServiceAccount
│       ├── hpa.yaml             # HorizontalPodAutoscaler
│       └── _helpers.tpl         # Template helpers
└── monitoring/
    ├── prometheus-configmap.yaml
    ├── prometheus-rules.yaml
    └── loki-configmap.yaml
```

### Manual Deployment (for testing)

**Development:**
```bash
helm upgrade --install chatbot-service ./helm/chatbot-service \
  --namespace chatbot-dev \
  --values ./helm/values-dev.yaml \
  --set image.tag=main-latest \
  --wait --timeout 5m
```

**Staging (Canary Deployment):**
```bash
helm upgrade --install chatbot-service ./helm/chatbot-service \
  --namespace chatbot-staging \
  --values ./helm/values-staging.yaml \
  --set image.tag=<sha> \
  --set replicaCount=2 \
  --set deploymentStrategy=canary \
  --wait --timeout 10m
```

**Production (Blue-Green Deployment):**
```bash
helm upgrade --install chatbot-service ./helm/chatbot-service \
  --namespace chatbot-prod \
  --values ./helm/values-prod.yaml \
  --set image.tag=v1.0.0 \
  --set replicaCount=3 \
  --set deploymentStrategy=blue-green \
  --wait --timeout 15m
```

### Verify Deployment

```bash
# Check deployment status
kubectl rollout status deployment/chatbot-service -n chatbot-prod --timeout=5m

# View pods
kubectl get pods -n chatbot-prod -l app=chatbot-service -o wide

# Check logs
kubectl logs -f deployment/chatbot-service -n chatbot-prod

# Port-forward to test locally
kubectl port-forward svc/chatbot-service 3001:80 -n chatbot-prod
curl http://localhost:3001/metrics
```

---

## Secrets Management

### Creating Secrets

**Option 1: kubectl (one-time setup)**
```bash
kubectl create secret generic chatbot-service-secrets \
  --from-literal=hf-access-token=<your-hf-token> \
  --from-literal=api-key=<your-api-key> \
  --from-literal=db-password=<your-db-password> \
  -n chatbot-dev
```

**Option 2: Using sealed-secrets or external secret operator**

For production, use a secret management tool:
- **Sealed Secrets**: Encrypts secrets at rest in Git
- **External Secrets Operator**: Integrates with Vault/AWS Secrets Manager
- **HashiCorp Vault**: Enterprise secret management

```bash
# Install sealed-secrets
helm repo add sealed-secrets https://kubernetes.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system

# Encrypt a secret
echo -n 'mysecret' | kubectl create secret generic mysecret \
  --dry-run=client \
  --from-file=/dev/stdin \
  -o yaml | kubeseal -f - > mysealedsecret.yaml
```

### GitHub Actions Secrets

Add these to your GitHub repository settings (`Settings > Secrets and variables > Actions`):

```yaml
# Kubernetes configs (base64-encoded)
K8S_DEV_KUBECONFIG_B64: <base64-encoded kubeconfig>
K8S_STAGING_KUBECONFIG_B64: <base64-encoded kubeconfig>
K8S_PROD_KUBECONFIG_B64: <base64-encoded kubeconfig>

K8S_DEV_CONTEXT: dev-context-name
K8S_STAGING_CONTEXT: staging-context-name
K8S_PROD_CONTEXT: prod-context-name

# API tokens
HF_ACCESS_TOKEN: hf_xxxxxxxxxxxx
PROD_API_KEY: your-prod-api-key

# Slack webhooks for notifications
SLACK_WEBHOOK_DEV: https://hooks.slack.com/services/...
SLACK_WEBHOOK_STAGING: https://hooks.slack.com/services/...
SLACK_WEBHOOK_PROD: https://hooks.slack.com/services/...
```

**Encoding kubeconfig:**
```bash
cat ~/.kube/config | base64 | pbcopy  # macOS
# or
cat ~/.kube/config | base64 > kubeconfig.b64  # Linux
```

---

## Observability & Monitoring

### Metrics (Prometheus)

The service exposes Prometheus metrics at `/metrics` port 3001.

**Key Metrics:**

```yaml
# Request metrics
http_request_duration_seconds           # Histogram (P50/95/99)
http_requests_total                     # Counter (by status, method)
http_request_size_bytes                 # Histogram
http_response_size_bytes                # Histogram

# Business metrics
chat_messages_total                     # Total messages processed
chat_intent_distribution                # Intent classification counts
rag_retrieval_latency_ms                # Vector search latency

# Resource metrics
process_cpu_seconds_total               # CPU usage
process_resident_memory_bytes           # Memory usage

# Database metrics
chatbot_db_pool_available_connections   # Connection pool status
chatbot_db_pool_waiting_requests        # Waiting connections

# External API metrics
huggingface_api_requests_total
huggingface_api_errors_total
qdrant_search_latency_ms
```

### Grafana Dashboards

**Default dashboards (auto-installed with Prometheus stack):**
- Kubernetes Cluster Monitoring
- Pod Resource Usage
- Application Performance

**Custom dashboard for Chatbot Service:**

```json
{
  "dashboard": {
    "title": "Chatbot Service Monitoring",
    "panels": [
      {
        "title": "Request Latency (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate (5xx)",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~'5..'}[5m])"
          }
        ]
      },
      {
        "title": "Pod CPU Usage",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{pod=~'chatbot-service-.*'}[5m])"
          }
        ]
      }
    ]
  }
}
```

### Logging (Loki)

Logs are collected via Loki and searchable in Grafana.

**Log format (JSON-structured):**
```json
{
  "timestamp": "2025-12-07T10:30:00Z",
  "level": "info",
  "request_id": "req-abc123",
  "message": "Chat message processed",
  "intent": "faq",
  "latency_ms": 145,
  "pod": "chatbot-service-xyz",
  "namespace": "chatbot-prod"
}
```

**Loki query examples:**

```promql
# All logs from chatbot-service
{app="chatbot-service"}

# Errors only
{app="chatbot-service"} | json | level="error"

# High latency requests
{app="chatbot-service"} | json | latency_ms > 1000

# By request ID (correlate traces)
{app="chatbot-service"} | json | request_id="req-abc123"
```

### Alerts

Alerts are defined in `k8s/monitoring/prometheus-rules.yaml`.

**Alert channels:** Slack, PagerDuty, email, etc.

**Example alert configuration for Slack:**

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# In AlertManager config:
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'slack-critical'

receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: $SLACK_WEBHOOK_PROD
        channel: '#alerts-prod'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## Troubleshooting

### Pod not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n chatbot-prod

# View logs
kubectl logs <pod-name> -n chatbot-prod
kubectl logs -p <pod-name> -n chatbot-prod  # Previous logs if crashed

# Check events
kubectl get events -n chatbot-prod --sort-by='.lastTimestamp'
```

### CrashLoopBackOff

```bash
# View deployment status
kubectl get deployment chatbot-service -n chatbot-prod

# Check resource requests vs actual
kubectl top pod -n chatbot-prod
kubectl describe node <node-name>

# Restart deployment
kubectl rollout restart deployment/chatbot-service -n chatbot-prod
```

### Database connection issues

```bash
# Verify database service is reachable
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  sh -c "nc -zv postgres-prod 5432"

# Check environment variables
kubectl exec <pod-name> -n chatbot-prod -- env | grep CHATBOT_DB
```

### High latency/errors

1. **Check metrics:**
   ```bash
   # In Grafana: Latency (P95) and Error Rate (5xx)
   ```

2. **Review logs:**
   ```bash
   kubectl logs deployment/chatbot-service -n chatbot-prod | tail -100
   ```

3. **Check resource saturation:**
   ```bash
   kubectl top pods -n chatbot-prod
   kubectl top nodes
   ```

4. **Scale up if needed:**
   ```bash
   kubectl scale deployment chatbot-service --replicas=5 -n chatbot-prod
   ```

---

## Rollback Procedures

### Automatic Rollback (if deployment fails)

The CD pipeline automatically fails and sends Slack notifications. Manual rollback:

### Manual Rollback

**Via Helm:**
```bash
# View release history
helm history chatbot-service -n chatbot-prod

# Rollback to previous release
helm rollback chatbot-service 5 -n chatbot-prod

# Verify
kubectl rollout status deployment/chatbot-service -n chatbot-prod --timeout=5m
```

**Via Kubernetes:**
```bash
# Undo last deployment
kubectl rollout undo deployment/chatbot-service -n chatbot-prod

# Rollback to specific revision
kubectl rollout history deployment/chatbot-service -n chatbot-prod
kubectl rollout undo deployment/chatbot-service --to-revision=5 -n chatbot-prod
```

### Blue-Green Rollback (Production)

For blue-green deployments:

```bash
# Switch traffic back to blue (old version)
kubectl patch service chatbot-service -p '{"spec":{"selector":{"version":"blue"}}}' -n chatbot-prod

# Verify traffic is on blue
kubectl get endpoints chatbot-service -n chatbot-prod
```

### Database Rollback

If migrations fail:

```bash
# View migration history
kubectl exec <pod> -n chatbot-prod -- npm run db:status

# Rollback migration
kubectl exec <pod> -n chatbot-prod -- npm run db:rollback
```

---

## Performance Baselines & SLOs

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **P95 Latency** | < 2s | > 2s (5m avg) |
| **P99 Latency** | < 5s | > 5s (2m avg) |
| **Error Rate (5xx)** | < 0.5% | > 5% (5m avg) |
| **Error Rate (4xx)** | < 5% | > 20% (5m avg) |
| **Availability** | 99.9% | < 99.5% (24h) |
| **CPU Usage** | < 70% | > 80% (5m avg) |
| **Memory Usage** | < 80% | > 85% (5m avg) |

---

## Next Steps

1. **Set up GitHub Action Secrets** (Kubernetes configs, API keys)
2. **Configure Slack webhooks** for deployment notifications
3. **Deploy monitoring stack** (Prometheus, Grafana, Loki, AlertManager)
4. **Create initial version tag** (v1.0.0) to trigger production deployment
5. **Test rollback procedures** in staging environment
6. **Document runbooks** for on-call incidents
7. **Set up PagerDuty** integration for critical alerts

---

**For questions or issues, refer to:**
- GitHub Actions Logs: Repository > Actions tab
- Kubernetes Dashboard: `kubectl proxy` then http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
- Grafana: https://grafana.yourdomain.com
- Alert History: Prometheus AlertManager UI
