try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv') as typeof import('dotenv');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  // process.cwd() = apps/slack-bot when run via pnpm --filter slack-bot
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
} catch {
  // dotenv not available — env vars provided by systemd EnvironmentFile in production
}
