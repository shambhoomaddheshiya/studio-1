"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Users, History, LayoutDashboard, CreditCard, Banknote, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Bulk Deposit', href: '/deposits', icon: Wallet },
  { name: 'Loans', href: '/loans', icon: Banknote },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'AI Assessment', href: '/ai-assessment', icon: Sparkles },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card px-4 sm:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-primary p-1.5 rounded-lg">
          <Banknote className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="font-headline text-xl font-bold tracking-tight text-primary">Yuva Finance 2</span>
      </div>
      
      <div className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-secondary text-secondary-foreground" 
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold">
          A
        </button>
      </div>
    </nav>
  );
}
