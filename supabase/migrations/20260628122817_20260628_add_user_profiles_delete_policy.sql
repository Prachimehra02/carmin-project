-- Add missing DELETE policy for user_profiles
CREATE POLICY "Users can delete own profile" ON public.user_profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);
