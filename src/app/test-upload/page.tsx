import { listScenes } from "@/lib/db/queries";
import { TestUploadClient } from "./TestUploadClient";

type PageProps = {
  searchParams: Promise<{ sceneId?: string }>;
};

export default async function TestUploadPage({ searchParams }: PageProps) {
  const [{ sceneId }, scenes] = await Promise.all([searchParams, listScenes()]);

  return (
    <TestUploadClient
      initialScenes={scenes.map((s) => ({ id: s.id, name: s.name }))}
      initialSceneId={sceneId ?? null}
    />
  );
}
