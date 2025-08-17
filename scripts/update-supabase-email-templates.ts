#!/usr/bin/env bun

/**
 * Script to update Supabase authentication email templates
 * Run with: doppler run -- bun scripts/update-supabase-email-templates.ts
 */

import { z } from "zod";

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ACCESS_TOKEN: z.string(),
  BASE_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

// Extract project reference from Supabase URL
const projectRef = env.SUPABASE_URL.split("//")[1].split(".")[0];

console.log(`🔧 Updating Supabase email templates for project: ${projectRef}`);

// Email template configurations
const emailTemplates = {
  // Confirm signup email
  confirm: {
    subject: "Welcome to Biscuits Internet Project - Confirm Your Email",
    body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: bold; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
            Biscuits Internet Project
          </h1>
          <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">
            Welcome to the ultimate resource for Disco Biscuits fans
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">
            Confirm Your Email Address
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            Thanks for signing up! Please confirm your email address to get started with full access to shows, setlists, and the community.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: linear-gradient(135deg, hsl(263, 85%, 60%) 0%, hsl(259, 85%, 50%) 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px hsla(263, 85%, 60%, 0.3); font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
              Confirm Email Address
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            © ${new Date().getFullYear()} Biscuits Internet Project. All rights reserved.
          </p>
          <p style="color: #9ca3af; margin: 5px 0 0 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            The ultimate resource for Disco Biscuits fans
          </p>
        </div>
      </div>
    `.trim(),
  },

  // Magic link email
  magic_link: {
    subject: "Sign in to Biscuits Internet Project",
    body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: bold; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
            Biscuits Internet Project
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">
            Sign In to Your Account
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            Click the button below to sign in to your Biscuits Internet Project account. This link will expire in 24 hours for security.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: linear-gradient(135deg, hsl(263, 85%, 60%) 0%, hsl(259, 85%, 50%) 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px hsla(263, 85%, 60%, 0.3); font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
              Sign In Now
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            If you didn't request this sign-in link, you can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; margin: 0; font-size: 14px;">
            © ${new Date().getFullYear()} Biscuits Internet Project. All rights reserved.
          </p>
        </div>
      </div>
    `.trim(),
  },

  // Password recovery email
  recovery: {
    subject: "Reset Your Biscuits Internet Project Password",
    body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: bold; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
            Biscuits Internet Project
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">
            Reset Your Password
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            We received a request to reset your password. Click the button below to choose a new password for your account.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: linear-gradient(135deg, hsl(263, 85%, 60%) 0%, hsl(259, 85%, 50%) 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px hsla(263, 85%, 60%, 0.3); font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
              Reset Password
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; margin: 0; font-size: 14px;">
            © ${new Date().getFullYear()} Biscuits Internet Project. All rights reserved.
          </p>
        </div>
      </div>
    `.trim(),
  },

  // Email change confirmation
  email_change: {
    subject: "Confirm Your New Email Address - Biscuits Internet Project",
    body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: bold; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
            Biscuits Internet Project
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px;">
            Confirm Your New Email Address
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            Please confirm your new email address to complete the change to your Biscuits Internet Project account.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: linear-gradient(135deg, hsl(263, 85%, 60%) 0%, hsl(259, 85%, 50%) 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px hsla(263, 85%, 60%, 0.3); font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;">
              Confirm New Email
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            If you didn't request this email change, please contact support immediately.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; margin: 0; font-size: 14px;">
            © ${new Date().getFullYear()} Biscuits Internet Project. All rights reserved.
          </p>
        </div>
      </div>
    `.trim(),
  },
};

// Function to update a specific email template
async function updateEmailTemplate(templateName: string, template: { subject: string; body: string }) {
  try {
    console.log(`📧 Updating ${templateName} template...`);

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        [`MAILER_TEMPLATES_${templateName.toUpperCase()}_SUBJECT`]: template.subject,
        [`MAILER_TEMPLATES_${templateName.toUpperCase()}_BODY`]: template.body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update ${templateName}: ${error}`);
    }

    console.log(`✅ ${templateName} template updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update ${templateName} template:`, error);
  }
}

// Main function to update all templates
async function updateAllEmailTemplates() {
  console.log('🚀 Starting email template updates...\n');

  for (const [templateName, template] of Object.entries(emailTemplates)) {
    await updateEmailTemplate(templateName, template);
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✨ All email templates have been updated!');
  console.log('\n📝 Updated templates:');
  console.log('   • Email confirmation (signup)');
  console.log('   • Magic link (passwordless login)');
  console.log('   • Password recovery');
  console.log('   • Email change confirmation');
  
  console.log('\n🔧 Next steps:');
  console.log('   • Templates are now active for all new auth emails');
  console.log('   • Test the flows to verify the styling');
  console.log('   • Check Supabase dashboard > Authentication > Email Templates');
}

// Run the script
if (import.meta.main) {
  updateAllEmailTemplates().catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}