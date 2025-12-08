import { db } from "../pgClient.js";
import { logger } from "../../observability/logger.js";

/**
 * FAQ Item interface
 */
export interface FaqItem {
  id?: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isActive: boolean;
}

/**
 * Repository for FAQ management
 */
export class FaqRepository {
  /**
   * Create a new FAQ item
   */
  async create(faq: Omit<FaqItem, "id">): Promise<FaqItem> {
    const query = `
      INSERT INTO faq_items 
        (title, content, category, tags, is_active)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING id, title, content, category, tags as "tags", is_active as "isActive", created_at, updated_at;
    `;

    const params = [
      faq.title,
      faq.content,
      faq.category,
      faq.tags,
      faq.isActive,
    ];

    try {
      const result = await db.query(query, params);
      const row = result.rows[0];
      logger.debug(
        { id: row.id, title: faq.title, category: faq.category },
        "✅ FAQ item created"
      );
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      };
    } catch (err) {
      logger.error({ err, title: faq.title }, "❌ Failed to create FAQ item");
      throw err;
    }
  }

  /**
   * Get FAQ by ID
   */
  async getById(id: number): Promise<FaqItem | null> {
    const query = `
      SELECT 
        id, title, content, category, tags, is_active as "isActive"
      FROM faq_items
      WHERE id = $1;
    `;

    try {
      const result = await db.query(query, [id]);
      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      };
    } catch (err) {
      logger.error({ err, id }, "❌ Failed to retrieve FAQ item");
      throw err;
    }
  }

  /**
   * Get all active FAQ items
   */
  async getAll(): Promise<FaqItem[]> {
    const query = `
      SELECT 
        id, title, content, category, tags, is_active as "isActive"
      FROM faq_items
      WHERE is_active = true
      ORDER BY category, id;
    `;

    try {
      const result = await db.query(query);
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      }));
    } catch (err) {
      logger.error({ err }, "❌ Failed to retrieve all FAQ items");
      throw err;
    }
  }

  /**
   * Get FAQ items by category
   */
  async getByCategory(category: string): Promise<FaqItem[]> {
    const query = `
      SELECT 
        id, title, content, category, tags, is_active as "isActive"
      FROM faq_items
      WHERE category = $1 AND is_active = true
      ORDER BY id;
    `;

    try {
      const result = await db.query(query, [category]);
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      }));
    } catch (err) {
      logger.error({ err, category }, "❌ Failed to retrieve FAQ items by category");
      throw err;
    }
  }

  /**
   * Update FAQ item
   */
  async update(id: number, faq: Partial<FaqItem>): Promise<FaqItem> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (faq.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(faq.title);
    }
    if (faq.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(faq.content);
    }
    if (faq.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(faq.category);
    }
    if (faq.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(faq.tags);
    }
    if (faq.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(faq.isActive);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE faq_items
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, title, content, category, tags as "tags", is_active as "isActive";
    `;

    try {
      const result = await db.query(query, params);
      const row = result.rows[0];
      if (!row) {
        throw new Error(`FAQ item with id ${id} not found`);
      }

      logger.debug({ id, title: row.title }, "✅ FAQ item updated");
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      };
    } catch (err) {
      logger.error({ err, id }, "❌ Failed to update FAQ item");
      throw err;
    }
  }

  /**
   * Delete FAQ item (soft delete - set is_active to false)
   */
  async delete(id: number): Promise<void> {
    const query = `
      UPDATE faq_items
      SET is_active = false, updated_at = NOW()
      WHERE id = $1;
    `;

    try {
      await db.query(query, [id]);
      logger.debug({ id }, "✅ FAQ item deleted (soft delete)");
    } catch (err) {
      logger.error({ err, id }, "❌ Failed to delete FAQ item");
      throw err;
    }
  }

  /**
   * Search FAQ by title or content
   */
  async search(query: string): Promise<FaqItem[]> {
    const searchQuery = `
      SELECT 
        id, title, content, category, tags, is_active as "isActive"
      FROM faq_items
      WHERE is_active = true 
        AND (title ILIKE $1 OR content ILIKE $1)
      ORDER BY category, id;
    `;

    try {
      const searchParam = `%${query}%`;
      const result = await db.query(searchQuery, [searchParam]);
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isActive: row.isActive,
      }));
    } catch (err) {
      logger.error({ err, query }, "❌ Failed to search FAQ items");
      throw err;
    }
  }

  /**
   * Get distinct categories
   */
  async getCategories(): Promise<string[]> {
    const query = `
      SELECT DISTINCT category
      FROM faq_items
      WHERE is_active = true
      ORDER BY category;
    `;

    try {
      const result = await db.query(query);
      return result.rows.map((row) => row.category);
    } catch (err) {
      logger.error({ err }, "❌ Failed to retrieve categories");
      throw err;
    }
  }
}

/**
 * Singleton instance
 */
export const faqRepository = new FaqRepository();
