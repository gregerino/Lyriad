import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listScenes, sceneExists } from "@/lib/db/queries";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";

export default async function Home() {
  const cookieStore = await cookies();
  const lastSceneId = cookieStore.get(LAST_SCENE_COOKIE)?.value;

  if (lastSceneId && (await sceneExists(lastSceneId))) {
    redirect(`/scenes/${lastSceneId}`);
  }

  const scenes = await listScenes();
  const mostRecent = scenes.at(-1);
  if (mostRecent) {
    redirect(`/scenes/${mostRecent.id}`);
  }

  redirect("/scenes");
}
