import { NewSessionForm } from "@/components/new-session-form";

export default function NewSessionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New session</h1>
      <NewSessionForm />
    </div>
  );
}
