#!/usr/bin/env node

/**
 * Update Supabase Email Templates
 *
 * This script updates the email templates in your Supabase project using the Management API.
 *
 * Prerequisites:
 * 1. Generate a Supabase access token at: https://supabase.com/dashboard/account/tokens
 * 2. Get your project reference from the Supabase dashboard URL (e.g., abcdefghijklmnop)
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=your_token SUPABASE_PROJECT_REF=your_ref node scripts/update-email-templates.js
 *
 * Or add to .env:
 *   SUPABASE_ACCESS_TOKEN=your_token
 *   SUPABASE_PROJECT_REF=your_ref
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import loadEnv from './lib/load-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
loadEnv();

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN is required');
  console.error('   Generate one at: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

if (!SUPABASE_PROJECT_REF) {
  console.error('❌ SUPABASE_PROJECT_REF is required');
  console.error('   Find it in your Supabase dashboard URL: https://supabase.com/dashboard/project/<ref>');
  process.exit(1);
}

const MANAGEMENT_API_URL = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`;

/**
 * Read template file content
 * @param {string} filename - Template filename
 * @returns {string} Template content
 */
const readTemplate = (filename) => {
  const templatePath = resolve(__dirname, '..', 'supabase', 'templates', filename);
  return readFileSync(templatePath, 'utf8');
};

/**
 * Email template configurations
 */
const EMAIL_TEMPLATES = {
  // Confirmation email (signup)
  mailer_templates_confirmation_content: readTemplate('confirm.html'),
  mailer_templates_confirmation_subject: 'Welcome to ParkLookup - Confirm Your Email',

  // Recovery email (password reset)
  mailer_templates_recovery_content: readTemplate('recovery.html'),
  mailer_templates_recovery_subject: 'Reset Your ParkLookup Password',

  // Magic link email
  mailer_templates_magic_link_content: readTemplate('magic_link.html'),
  mailer_templates_magic_link_subject: 'Sign In to ParkLookup',

  // Email change confirmation
  mailer_templates_email_change_content: readTemplate('email_change.html'),
  mailer_templates_email_change_subject: 'Confirm Your New Email - ParkLookup',

  // Invite email
  mailer_templates_invite_content: readTemplate('invite.html'),
  mailer_templates_invite_subject: "You're Invited to ParkLookup",
};

/**
 * Update email templates via Supabase Management API
 */
const updateEmailTemplates = async () => {
  console.log('🚀 Updating Supabase email templates...\n');

  try {
    const response = await fetch(MANAGEMENT_API_URL, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(EMAIL_TEMPLATES),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Email templates updated successfully!\n');
    console.log('Updated templates:');
    console.log('  📧 Confirmation (signup)');
    console.log('  🔑 Recovery (password reset)');
    console.log('  ✨ Magic Link');
    console.log('  📝 Email Change');
    console.log('  💌 Invite');
    console.log('\n🎉 All done! Your branded emails are now active.');

    return result;
  } catch (error) {
    console.error('❌ Failed to update email templates:', error.message);
    process.exit(1);
  }
};

// Run the script
updateEmailTemplates();
