'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const loadingToast = toast.loading('Signing in...');
      await login(email, password);
      toast.dismiss(loadingToast);
      toast.success('Welcome back!', {
        duration: 2000,
      });
      // Small delay to allow toast to display before navigation
      setTimeout(() => {
        router.push('/home');
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fade-in">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/Frame 1.svg"
              alt="Little AIDE Logo"
              width={200}
              height={56}
              priority
            />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p className="text-slate-600">Sign in to your AIDE account</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="mb-4 bg-red-50 text-red-800 border-red-200">
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full"
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary-blue rounded border-gray-300 focus:ring-primary-blue"
              />
              <Label htmlFor="remember" className="ml-2 text-sm text-slate-600 cursor-pointer">
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-submit text-white py-6 text-lg font-semibold hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#4A90E2] hover:text-[#00E0FF] font-semibold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/Group 4.svg"
              alt="AIDE Icon"
              width={24}
              height={24}
              className="opacity-60"
            />
            <p className="text-slate-400 text-sm">&copy; 2024 AIDE. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
