# Supabase Database Setup Guide for WorkJournal

This guide will help you set up your Supabase database for the WorkJournal application.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A new Supabase project created

## Step 1: Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `workjournal` (or your preferred name)
   - Database Password: Generate a secure password and save it
   - Region: Choose the closest region to your users
5. Click "Create new project"
6. Wait for the project to be set up (usually takes 1-2 minutes)

## Step 2: Run the Database Setup SQL

1. In your Supabase dashboard, go to the **SQL Editor** (in the left sidebar)
2. Click "New Query"
3. Copy and paste the entire content of `database-setup.sql` into the editor
4. Click "Run" to execute the SQL
5. You should see a success message confirming all tables and functions were created

## Step 3: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like `https://your-project-id.supabase.co`)
   - **anon/public key** (the `anon` key under "Project API keys")

## Step 4: Update Your Environment Variables

1. Open the `.env.local` file in your project root
2. Replace the placeholder values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## Step 5: Set Up Authentication (Optional but Recommended)

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Configure your site URL:
   - For development: `http://localhost:3000`
   - For production: your deployed domain
3. Enable email confirmation if desired
4. Configure OAuth providers if needed (Google, GitHub, etc.)

## Step 6: Test the Database Setup

1. Restart your Next.js development server if it's running
2. Go to the SQL Editor in Supabase
3. Run the sample queries from `sample-data-and-queries.sql` to test everything works
4. You can also add some sample data using the provided INSERT statements

## Step 7: Verify the Application Connection

1. Open your application at `http://localhost:3000`
2. The error about invalid Supabase URL should be gone
3. Check the browser console for any remaining connection issues
4. You can test the API endpoint: `http://localhost:3000/api/test-env`

## Database Schema Overview

Your database now includes:

### Tables:
- **entries**: Main journal entries with content, tags, status, etc.
- **tasks**: Tasks associated with entries, with priorities and statuses

### Features:
- **Row Level Security (RLS)**: Users can only access their own data
- **Automatic word counting**: Entry word counts are calculated automatically
- **Timestamps**: Automatic `created_at` and `updated_at` tracking
- **Task completion tracking**: Automatic `completed_at` when tasks are marked complete
- **Indexes**: Optimized for common query patterns

### Views:
- **entry_stats**: Analytics view for entry statistics
- **task_stats**: Analytics view for task statistics

## Troubleshooting

### Common Issues:

1. **"Invalid supabaseUrl" error**:
   - Make sure your `.env.local` file has the correct URL format
   - Restart your development server after changing environment variables

2. **Authentication errors**:
   - Verify your anon key is correct
   - Check that RLS policies are properly set up

3. **Permission denied errors**:
   - Ensure you're authenticated when testing
   - Verify RLS policies are working as expected

4. **Connection timeouts**:
   - Check your internet connection
   - Verify the Supabase project is running (not paused)

### Testing Authentication:

You can test authentication by creating a user account:

```sql
-- In Supabase SQL Editor, you can create a test user:
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);
```

## Next Steps

1. Implement user authentication in your frontend
2. Add the sample data to test the application
3. Customize the database schema if needed for your specific use case
4. Set up database backups and monitoring in production

## Need Help?

- Check the [Supabase Documentation](https://supabase.com/docs)
- Review the [Next.js Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- Check the application console for detailed error messages
