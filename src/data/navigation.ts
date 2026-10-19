import {
  Beaker,
  Bug,
  ClipboardList,
  Database,
  Dna,
  FileUp,
  FlaskConical,
  Grid3X3,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Microscope,
  Pill,
  Scale,
  Settings,
  Shield,
  Sparkles,
  TestTube2,
  User,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

/** A leaf navigation entry that links to a route. */
export interface NavLeaf {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
}

/** A parent entry that groups leaves one level deep (collapsible, no own route). */
export interface NavGroup {
  title: string
  icon: LucideIcon
  items: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

export const navigationItems: NavEntry[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Chat', href: '/insights', icon: Sparkles },
  { title: 'Nutrition', href: '/nutrition', icon: Utensils },
  {
    title: 'Results',
    icon: Layers,
    items: [
      { title: 'Blood Tests', href: '/tests', icon: FlaskConical },
      { title: 'DUTCH Tests', href: '/dutch', icon: TestTube2, badge: 'New' },
      { title: 'Microbiome', href: '/microbiome', icon: Bug, badge: 'New' },
      { title: 'Body Comp', href: '/body', icon: Scale, badge: 'New' },
      { title: 'Genetics', href: '/genetics', icon: Dna },
      { title: 'Other tests', href: '/other', icon: ClipboardList, badge: 'New' },
    ],
  },
  {
    title: 'Markers',
    icon: LineChart,
    items: [
      { title: 'Marker Grid', href: '/grid', icon: Grid3X3 },
      { title: 'Biomarkers', href: '/biomarkers', icon: Microscope },
    ],
  },
  {
    title: 'Plan',
    icon: ListChecks,
    items: [
      { title: 'Next to test', href: '/next-to-test', icon: ClipboardList },
      { title: 'Labs', href: '/labs', icon: Beaker },
      { title: 'Import', href: '/import', icon: FileUp },
    ],
  },
  {
    title: 'Profile',
    icon: User,
    items: [
      { title: 'Account', href: '/profile', icon: Settings },
      { title: 'Stack', href: '/supplements', icon: Pill },
    ],
  },
]

export const adminNavigationItems: NavEntry[] = [
  { title: 'Overview', href: '/admin', icon: Shield },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Suggestions', href: '/admin/suggestions', icon: ClipboardList },
  {
    title: 'Catalog',
    icon: Database,
    items: [
      { title: 'Biomarkers', href: '/admin/biomarkers', icon: Database },
      { title: 'Labs', href: '/admin/labs', icon: Beaker },
    ],
  },
]
