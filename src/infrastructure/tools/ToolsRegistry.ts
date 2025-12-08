import type { Tool } from '../../domain/types.js';
import { ProductSearchTool } from './ProductSearchTools.js';
export class ToolsRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.register(new ProductSearchTool());
  }

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const toolsRegistry = new ToolsRegistry();