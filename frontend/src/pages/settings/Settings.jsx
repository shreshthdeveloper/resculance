import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  User,
  Lock,
  Bell,
  Building2,
  Save,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { useRef } from 'react';

const profileSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  phone: yup.string().required('Phone is required'),
  // Email removed from validation - will be disabled in UI
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  confirmPassword: yup
    .string()
    .required('Confirm password is required')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { user, setUser, updateProfile, getProfile } = useAuthStore();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm({
    resolver: yupResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: yupResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      console.log('Settings: Populating form with user data', user);
      resetProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user, resetProfile]);

  const onSubmitProfile = async (data) => {
    try {
      setLoading(true);
      setSuccessMessage('');
      // Use auth store's updateProfile which refreshes profile from server
      await updateProfile(data);
      toast.success('Profile updated successfully');
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPassword = async (data) => {
    try {
      setLoading(true);
      setSuccessMessage('');
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed successfully');
      setSuccessMessage('Password changed successfully!');
      resetPassword();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'organization', label: 'Organization', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      
      
      {/* Header */}
      <div>
  <h1 className="text-3xl font-display font-bold mt-5 mb-2">Settings</h1>
        <p className="text-secondary">Manage your account settings and preferences</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-2xl flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <Card className="p-4 h-fit">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'text-secondary hover:bg-background-card'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Profile Information</h2>
                  <p className="text-secondary">Update your account profile information</p>
                </div>

                <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-6">
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const objectUrl = URL.createObjectURL(file);
                              setPreviewUrl(objectUrl);
                              setUploading(true);
                              const fd = new FormData();
                              fd.append('avatar', file);
                              const resp = await authService.uploadProfileImage(fd);
                              // Refresh profile in store
                              await getProfile();
                              toast.success('Profile image updated');
                              setPreviewUrl(null);
                            } catch (err) {
                              console.error('Failed to upload avatar', err);
                              toast.error('Failed to upload image');
                            } finally {
                              setUploading(false);
                            }
                          }}
                        />

                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => fileInputRef.current?.click()}
                          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                          className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold cursor-pointer overflow-hidden"
                          title="Click to upload avatar"
                        >
                          {previewUrl ? (
                            <img src={previewUrl} alt="avatar preview" className="w-full h-full object-cover" onError={() => setPreviewUrl(null)} />
                          ) : user?.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setPreviewUrl(null)} />
                          ) : (
                            <>
                              {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </>
                          )}
                        </div>
                        {uploading && <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm text-white">Uploading...</span></div>}
                      </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-sm text-secondary">{user?.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      {...registerProfile('firstName')}
                      error={profileErrors.firstName?.message}
                    />
                    <Input
                      label="Last Name"
                      {...registerProfile('lastName')}
                      error={profileErrors.lastName?.message}
                    />
                  </div>

                  <Input
                    label="Email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                    readOnly
                  />

                  <Input
                    label="Phone"
                    {...registerProfile('phone')}
                    error={profileErrors.phone?.message}
                  />

                  {/* Role hidden as per requirement */}

                  {user?.licenseNumber && (
                    <Input
                      label="License Number"
                      value={user.licenseNumber}
                      disabled
                    />
                  )}

                  {user?.specialization && (
                    <Input
                      label="Specialization"
                      value={user.specialization}
                      disabled
                    />
                  )}

                  <div className="flex justify-end pt-4">
                    <Button type="submit" loading={loading}>
                      <Save className="w-5 h-5 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Change Password</h2>
                  <p className="text-secondary">Update your password to keep your account secure</p>
                </div>

                <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-6">
                  <Input
                    label="Current Password"
                    type="password"
                    {...registerPassword('currentPassword')}
                    error={passwordErrors.currentPassword?.message}
                  />

                  <Input
                    label="New Password"
                    type="password"
                    {...registerPassword('newPassword')}
                    error={passwordErrors.newPassword?.message}
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    {...registerPassword('confirmPassword')}
                    error={passwordErrors.confirmPassword?.message}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      Password Requirements:
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>At least 8 characters long</li>
                      <li>Contains uppercase and lowercase letters</li>
                      <li>Contains at least one number</li>
                      <li>Contains at least one special character (@$!%*?&#)</li>
                    </ul>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" loading={loading}>
                      <Lock className="w-5 h-5 mr-2" />
                      Change Password
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Organization Tab */}
            {activeTab === 'organization' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Organization Details</h2>
                  <p className="text-secondary">View your organization information</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-2xl">
                    <p className="text-sm text-secondary mb-1">Organization Name</p>
                    <p className="font-semibold">{user?.organizationName || user?.organization_name || 'N/A'}</p>
                  </div>

                  <div className="p-4 border border-border rounded-2xl">
                    <p className="text-sm text-secondary mb-1">Organization Type</p>
                    <p className="font-semibold">{user?.organizationType || 'N/A'}</p>
                  </div>

                  <div className="p-4 border border-border rounded-2xl">
                    <p className="text-sm text-secondary mb-1">Member Since</p>
                    <p className="font-semibold">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>

                  <div className="p-4 border border-border rounded-2xl">
                    <p className="text-sm text-secondary mb-1">Account Status</p>
                    <span className="inline-flex px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
