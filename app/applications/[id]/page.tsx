import { Workspace } from "@/components/workspace/Workspace";

export default function ApplicationWorkspacePage({ params }: { params: { id: string } }) {
  return <Workspace applicationId={params.id} />;
}
