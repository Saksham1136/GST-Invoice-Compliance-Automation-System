import React from "react";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Profile</h1>
      <div className="mt-6 bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <p className="text-slate-300">
          <strong>Name:</strong> {user?.name}
        </p>
        <p className="text-slate-300 mt-2">
          <strong>Email:</strong> {user?.email}
        </p>
        <p className="text-slate-300 mt-2">
          <strong>Role:</strong> {user?.role}
        </p>
      </div>
    </div>
  );
}
