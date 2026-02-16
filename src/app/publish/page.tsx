import Link from 'next/link';

export const metadata = {
  title: 'Publish a Formation — Tide',
  description: 'Learn how to publish your multi-agent formation to the Tide registry.',
};

export default function PublishGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Publish a Formation</h1>
      <p className="mt-3 text-lg text-muted">
        Share your multi-agent formations with the OpenReef community. Publishing
        takes just a few steps.
      </p>

      {/* Step 1 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            1
          </span>
          <h2 className="text-xl font-semibold">Create a formation</h2>
        </div>
        <div className="ml-11 mt-3">
          <p className="text-muted">
            Initialize a new formation project in your working directory. This creates
            a <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-accent-light">reef.json</code> manifest
            file with your formation&apos;s configuration.
          </p>
          <pre className="mt-4 rounded-lg border border-border bg-surface p-4 overflow-x-auto">
            <code className="text-sm text-accent-light">$ reef init my-formation</code>
          </pre>
          <p className="mt-4 text-sm text-muted">
            Edit <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-accent-light">reef.json</code> to
            define your agents, connections, and configuration:
          </p>
          <pre className="mt-4 rounded-lg border border-border bg-surface p-4 overflow-x-auto">
            <code className="text-sm text-foreground">{`{
  "name": "my-formation",
  "version": "1.0.0",
  "description": "A multi-agent workflow for...",
  "type": "shoal",
  "license": "MIT",
  "agents": [
    {
      "name": "planner",
      "model": "claude-sonnet",
      "role": "Plans and coordinates tasks"
    },
    {
      "name": "executor",
      "model": "claude-haiku",
      "role": "Executes planned tasks"
    }
  ],
  "agentToAgent": [
    { "from": "planner", "to": "executor", "channel": "tasks" }
  ]
}`}</code>
          </pre>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            2
          </span>
          <h2 className="text-xl font-semibold">Get an API token</h2>
        </div>
        <div className="ml-11 mt-3">
          <p className="text-muted">
            You need an API token to authenticate with the Tide registry. Generate one
            from your{' '}
            <Link href="/dashboard" className="text-accent hover:text-accent-light">
              Dashboard
            </Link>
            .
          </p>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
            <strong>Important:</strong> Your token is only shown once when generated.
            Copy it immediately and store it securely.
          </div>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            3
          </span>
          <h2 className="text-xl font-semibold">Set your token</h2>
        </div>
        <div className="ml-11 mt-3">
          <p className="text-muted">
            Set the <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-accent-light">REEF_TOKEN</code> environment
            variable with your API token:
          </p>
          <pre className="mt-4 rounded-lg border border-border bg-surface p-4 overflow-x-auto">
            <code className="text-sm text-accent-light">$ export REEF_TOKEN=reef_tok_your_token_here</code>
          </pre>
          <p className="mt-3 text-sm text-muted">
            You can also add this to your shell profile (<code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-accent-light">~/.bashrc</code>,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-accent-light">~/.zshrc</code>) for persistence.
          </p>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            4
          </span>
          <h2 className="text-xl font-semibold">Publish</h2>
        </div>
        <div className="ml-11 mt-3">
          <p className="text-muted">
            Run the publish command from your formation&apos;s directory:
          </p>
          <pre className="mt-4 rounded-lg border border-border bg-surface p-4 overflow-x-auto">
            <code className="text-sm text-accent-light">$ reef publish .</code>
          </pre>
          <p className="mt-3 text-sm text-muted">
            This will package your formation, upload it to the Tide registry, and make
            it available for others to install.
          </p>
        </div>
      </section>

      {/* After publishing */}
      <section className="mt-12 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold">After publishing</h3>
        <p className="mt-2 text-sm text-muted">
          Once published, your formation will be available for anyone to install:
        </p>
        <pre className="mt-3 rounded-lg border border-border bg-background p-3 overflow-x-auto">
          <code className="text-sm text-accent-light">$ reef install my-formation</code>
        </pre>
        <p className="mt-3 text-sm text-muted">
          You can view and manage your published formations from your{' '}
          <Link href="/dashboard" className="text-accent hover:text-accent-light">
            Dashboard
          </Link>
          . To publish a new version, update the{' '}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-accent-light">version</code> field
          in <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-accent-light">reef.json</code> and
          run <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-accent-light">reef publish .</code> again.
        </p>
      </section>
    </div>
  );
}
