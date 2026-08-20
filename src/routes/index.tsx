import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RootComponent,
});

function RootComponent() {
  return <div>Loading...</div>;
}
