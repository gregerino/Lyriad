import { SceneClient } from "@/components/scenes/SceneClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function ScenePage({ params }: PageProps) {
  const { id } = await params;
  return <SceneClient key={id} sceneId={id} />;
}
