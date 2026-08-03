import { CollectionClient } from "@/components/audio/CollectionClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  return <CollectionClient key={id} collectionId={id} />;
}
