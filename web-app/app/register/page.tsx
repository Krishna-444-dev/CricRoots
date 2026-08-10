'use client';

import PlayerRegistrationForm from '@/components/player/PlayerRegistrationForm';

function generateDemoPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function RegisterPage() {
  const handleSubmit = async (formData: any) => {
    const password = generateDemoPassword();
    const result: {
      name: string;
      email: string;
      password: string;
      accountCreated: boolean;
      playerProfileCreated: boolean;
      error: string | null;
    } = {
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      password,
      accountCreated: false,
      playerProfileCreated: false,
      error: null,
    };

    try {
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.name,
          email: formData.email,
          password,
          role: 'player',
        }),
      });
      const registerData = await registerRes.json();

      if (!registerData.success) {
        result.error = registerData.message || 'Registration failed';
        sessionStorage.setItem('cricsync_registration', JSON.stringify(result));
        return;
      }

      result.accountCreated = true;

      const playerRes = await fetch('/api/players/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${registerData.token}`,
        },
        body: JSON.stringify({
          user: registerData.user.id,
          specialization: formData.cricketInfo.playingRole,
          battingStyle: formData.cricketInfo.battingStyle || 'Right-hand',
          bowlingStyle: formData.cricketInfo.bowlingStyle || 'None',
        }),
      });
      const playerData = await playerRes.json();
      result.playerProfileCreated = Boolean(playerData.success);
      if (!playerData.success) {
        result.error = playerData.message || 'Player profile could not be created';
      }
    } catch (err) {
      result.error = 'Could not reach the CricSync server';
    } finally {
      sessionStorage.setItem('cricsync_registration', JSON.stringify(result));
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <PlayerRegistrationForm onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
