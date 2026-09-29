import { query, getClient } from '../config/database.js';

export const getCompany = async (req, res) => {
  try {
    const { company_id } = req.user;

    const result = await query(
      'SELECT id, name, industry, country, timezone, tracking_preferences, due_soon_days, stale_days, created_at, updated_at FROM companies WHERE id = $1',
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

// Module 2: called from the last onboarding step ("All Set!")
export const completeOnboarding = async (req, res) => {
  const result = await query(
    'UPDATE companies SET onboarding_completed = true, updated_at = NOW() WHERE id = $1 RETURNING id',
    [req.user.company_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Company not found' });
  }

  res.json({ message: 'Onboarding completed', onboarding_completed: true });
};

export const updateCompany = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { name, industry, country, timezone, tracking_preferences } = req.body;

    // Needs Attention thresholds (Module 22): whole days within sensible ranges
    const readDays = (value, min, max, label) => {
      if (value === undefined || value === null || value === '') return { value: null };
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} must be a whole number between ${min} and ${max}` };
      return { value: n };
    };
    const dueSoon = readDays(req.body.due_soon_days, 0, 30, 'Due soon days');
    const stale = readDays(req.body.stale_days, 1, 60, 'Stale order days');
    if (dueSoon.error || stale.error) {
      return res.status(400).json({ error: dueSoon.error || stale.error });
    }

    const result = await query(
      `UPDATE companies 
       SET name = COALESCE($1, name), 
           industry = COALESCE($2, industry), 
           country = COALESCE($3, country), 
           timezone = COALESCE($4, timezone), 
           tracking_preferences = COALESCE($5, tracking_preferences),
           due_soon_days = COALESCE($7, due_soon_days),
           stale_days = COALESCE($8, stale_days),
           updated_at = NOW() 
       WHERE id = $6 
       RETURNING id, name, industry, country, timezone, tracking_preferences, due_soon_days, stale_days, updated_at`,
      [name, industry, country, timezone, tracking_preferences, company_id, dueSoon.value, stale.value]
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
