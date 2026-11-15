import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Theme} from '@astryxdesign/core/theme';
import {TopNav, TopNavItem} from '@astryxdesign/core/TopNav';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
// Theme tokens. Figtree is self-hosted below instead of the theme's Google
// Fonts @import, so the app works offline and makes no third-party requests.
import '@astryxdesign/theme-neutral/theme.css';
import {Moon, Sun} from 'lucide-react';

import {ProgressProvider} from './lib/progress';
import {href, useRoute} from './lib/router';
import {useSettings} from './lib/useSettings';
import {BrowseScreen} from './screens/browse';
import {DumpScreen} from './screens/dump';
import {ImportScreen} from './screens/import';
import {PracticeScreen} from './screens/practice';
import {ProgressScreen} from './screens/progress';
import {ResultsScreen} from './screens/results';

export function App() {
  const route = useRoute();
  const [settings, update] = useSettings();
  const isStudy = route.name === 'practice' || route.name === 'results';
  const initial =
    route.name === 'browse' ||
    route.name === 'dump' ||
    route.name === 'practice' ||
    route.name === 'results';

  const toggleTheme = () => {
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;
    update({theme: effective === 'dark' ? 'light' : 'dark'});
  };

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Theme theme={neutralTheme} mode={settings.theme}>
      <ProgressProvider>
        <AppShell
          height="fill"
          contentPadding={0}
          topNav={
            <TopNav
              label="Main"
              heading={
                <Text type="large" weight="bold">
                  Meso
                </Text>
              }
              startContent={
                <HStack gap={1}>
                  <TopNavItem label="Practice" href={href('/')} isSelected={initial} />
                  <TopNavItem label="Import" href={href('/import')} isSelected={route.name === 'import'} />
                  <TopNavItem
                    label="Progress"
                    href={href('/progress')}
                    isSelected={route.name === 'progress'}
                  />
                </HStack>
              }
              endContent={
                <Button
                  variant="secondary"
                  isIconOnly
                  label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
                  onClick={toggleTheme}
                />
              }
            />
          }
        >
          <Layout
            height="fill"
            padding={4}
            contentWidth={isStudy ? 760 : 1040}
            content={
              <LayoutContent>
                {route.name === 'browse' ? <BrowseScreen /> : null}
                {route.name === 'import' ? <ImportScreen /> : null}
                {route.name === 'progress' ? <ProgressScreen /> : null}
                {route.name === 'dump' ? <DumpScreen id={route.id} /> : null}
                {route.name === 'practice' ? <PracticeScreen sessionId={route.sessionId} /> : null}
                {route.name === 'results' ? <ResultsScreen sessionId={route.sessionId} /> : null}
              </LayoutContent>
            }
          />
        </AppShell>
      </ProgressProvider>
    </Theme>
  );
}
