'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Video, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoomQuickActions } from '@/features/admin/dashboard/room-quick-action-card';

export default function DashboardPage() {
  const { admin } = useAuthStore();

  const stats = [
    { title: 'Active Rooms', value: '0', icon: Users, color: 'text-primary' },
    { title: 'Total Videos', value: '0', icon: Video, color: 'text-accent' },
    { title: 'Total Views', value: '0', icon: TrendingUp, color: 'text-success' },
    { title: 'Watch Time', value: '0h', icon: Clock, color: 'text-info' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {admin?.username}!</h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with your EchoFrame platform today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-accent/20 to-transparent" />
          </Card>
        ))}
      </div>
      <RoomQuickActions/>
    </div>
  );
}