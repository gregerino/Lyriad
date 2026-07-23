import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MixerHome } from "@/components/scenes/MixerHome";
import { sceneExists } from "@/lib/db/queries";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";

export default async function Home() {
  const cookieStore = await cookies();
  const lastSceneId = cookieStore.get(LAST_SCENE_COOKIE)?.value;

  if (lastSceneId && (await sceneExists(lastSceneId))) {
    redirect(`/scenes/${lastSceneId}`);
  }

  return <MixerHome />;
}
