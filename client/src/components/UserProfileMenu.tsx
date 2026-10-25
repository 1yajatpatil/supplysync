import React, { useState, useRef, useEffect } from 'react';
import { 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  ChevronDown,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserProfileMenu: React.FC = () => {
  const { user, logout, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="text-xs font-semibold text-[#191B19] hover:text-[#526B50] px-3 py-1.5 rounded-lg border border-[#E5E6E0] bg-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs hover:border-[#D0D2C8]"
        >
          <LogIn className="w-3.5 h-3.5 text-[#526B50]" />
          <span>Sign In</span>
        </button>
        <button
          type="button"
          onClick={() => openAuthModal('register')}
          className="text-xs font-semibold text-white bg-[#191B19] hover:bg-[#2E312E] px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <span>Register</span>
        </button>
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-xl border border-[#E5E6E0] bg-white hover:bg-[#F7F7F4] transition-all cursor-pointer shadow-2xs hover:border-[#D0D2C8]"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-6 h-6 rounded-lg bg-[#526B50] text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-xs font-bold text-[#191B19] truncate max-w-[110px] leading-tight">
            {user.name || user.email.split('@')[0]}
          </div>
          <div className="text-[10px] text-[#70736E] capitalize leading-none">
            {user.role === 'lead_planner' ? 'Lead Planner' : 'Planner'}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#70736E]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E5E6E0] shadow-xl p-3 z-50 animate-fadeIn space-y-3 text-xs">
          {/* User Details */}
          <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] space-y-1">
            <div className="font-bold text-[#191B19] flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[#526B50]" />
              <span>{user.name || 'Verified Planner'}</span>
            </div>
            <div className="text-[11px] text-[#70736E] font-mono truncate">
              {user.email}
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-[10px] font-semibold text-[#526B50]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#526B50]" />
              <span>Persistent Authenticated Session</span>
            </div>
          </div>

          {/* Quick Info */}
          <div className="px-1 text-[11px] text-[#70736E] space-y-1">
            <div className="flex justify-between">
              <span>Account Role:</span>
              <span className="font-semibold text-[#191B19] capitalize">
                {user.role === 'lead_planner' ? 'Lead Supply Planner' : 'Supply Planner'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Permissions:</span>
              <span className="font-semibold text-[#526B50]">Optimization & Export</span>
            </div>
          </div>

          <div className="border-t border-[#E5E6E0] pt-2">
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-red-600 hover:bg-red-50 font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
