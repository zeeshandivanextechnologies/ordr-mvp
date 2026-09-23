import { query, getClient } from '../config/database.js';

export const getCompany = async (req, res) => {
  try {
    const { company_id } = req.user;

    const result = await query(
      'SELECT id, name, industry, country, timezone, tracking_preferences, created_at, updated_at FROM companies WHERE id = $1',
      [company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    throw error;
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { name, industry, country, timezone, tracking_preferences } = req.body;

    const result = await query(
      `UPDATE companies 
       SET name = COALESCE($1, name), 
           industry = COALESCE($2, industry), 
           country = COALESCE($3, country), 
           timezone = COALESCE($4, timezone), 
           tracking_preferences = COALESCE($5, tracking_preferences),
           updated_at = NOW() 
       WHERE id = $6 
       RETURNING id, name, industry, country, timezone, tracking_preferences, updated_at`,
      [name, industry, country, timezone, tracking_preferences, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ 
      message: 'Company updated successfully',
      company: result.rows[0] 
    });
  } catch (error) {
    throw error;
  }
};
