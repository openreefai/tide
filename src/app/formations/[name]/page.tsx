import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import FormationDetail from '@/components/formation-detail';

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { name } = await params;
  return {
    title: `${name} — Tide`,
    description: `View the ${name} formation on Tide`,
  };
}

export default async function FormationPage({ params }: PageProps) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch formation details
  const { data: formation, error } = await supabase
    .from('formations')
    .select(`
      id, name, description, type, license, homepage_url, repository_url,
      latest_version, total_downloads, created_at, updated_at,
      owner_id,
      users!formations_owner_id_fkey(github_username, avatar_url, display_name)
    `)
    .eq('name', name)
    .is('deleted_at', null)
    .single();

  if (error || !formation) {
    notFound();
  }

  // Fetch star count
  const { count: stars } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true })
    .eq('formation_id', formation.id);

  // Fetch readme from latest version
  let readme = '';
  let reefJson: Record<string, unknown> | null = null;

  if (formation.latest_version) {
    const { data: latestVersion } = await supabase
      .from('formation_versions')
      .select('readme, reef_json')
      .eq('formation_id', formation.id)
      .eq('version', formation.latest_version)
      .single();

    if (latestVersion) {
      readme = latestVersion.readme ?? '';
      reefJson = latestVersion.reef_json as Record<string, unknown> | null;
    }
  }

  // Fetch all versions
  const { data: versions } = await supabase
    .from('formation_versions')
    .select('version, published_at, tarball_size, agent_count, is_prerelease')
    .eq('formation_id', formation.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Normalize the users field: Supabase may return an array for a single join
  const usersRaw = formation.users;
  const usersNormalized = Array.isArray(usersRaw) ? usersRaw[0] ?? null : usersRaw;

  return (
    <FormationDetail
      formation={{
        name: formation.name,
        description: formation.description,
        type: formation.type,
        license: formation.license,
        latest_version: formation.latest_version,
        total_downloads: formation.total_downloads,
        created_at: formation.created_at,
        updated_at: formation.updated_at,
        repository_url: formation.repository_url,
        homepage_url: formation.homepage_url,
        owner_id: formation.owner_id,
        users: usersNormalized as { github_username: string; avatar_url: string | null; display_name: string | null } | null,
        stars: stars ?? 0,
      }}
      readme={readme}
      versions={versions ?? []}
      reefJson={reefJson}
    />
  );
}
