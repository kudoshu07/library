-- Public Supabase Storage bucket for in-flight blog draft images.
--
-- The blog editor uploads images here while the user is still drafting,
-- so they display instantly (no Vercel rebuild gap). When the user hits
-- 公開, the publish endpoint downloads each referenced image from this
-- bucket, rewrites the URL in the MDX to "/{slug}/{filename}", and
-- commits the image + MDX to GitHub in a single atomic commit. The
-- draft row + its Storage objects are then deleted together.
--
-- Public read is OK because (a) any image referenced by an unpublished
-- draft is meant to be seen and (b) the URLs include random suffixes
-- so they're effectively unguessable. Writes are gated by the service
-- role key (bypasses RLS) wielded by the Next.js API routes, which
-- already enforce the owner-only session check upstream.

insert into storage.buckets (id, name, public)
values ('blog-draft-images', 'blog-draft-images', true)
on conflict (id) do update set public = excluded.public;

-- Allow anonymous SELECT on the bucket so the editor can render the
-- images it just uploaded. Service role bypasses RLS so writes/deletes
-- don't need an explicit policy.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'blog_draft_images_public_read'
  ) then
    create policy blog_draft_images_public_read
      on storage.objects
      for select
      using (bucket_id = 'blog-draft-images');
  end if;
end$$;
