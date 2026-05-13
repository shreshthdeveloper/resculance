import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useForm, Controller } from 'react-hook-form';
import Select from '../../components/ui/Select';
import { organizationService } from '../../services';
import useUiStore from '../../store/uiStore';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';
import { useToast } from '../../hooks/useToast';

export const Organizations = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showLoader, hideLoader } = useUiStore();
  const runWithLoader = useWithGlobalLoader();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrganizations();
  }, [filterType]);

  // Listen for global cache reset and refresh organizations
  useEffect(() => {
    const handler = async () => {
      try {
        await fetchOrganizations();
      } catch (err) {
        console.error('Global reset handler failed for organizations', err);
      } finally {
        window.dispatchEvent(new CustomEvent('global:cache-reset-done', { detail: { page: 'organizations' } }));
      }
    };
    window.addEventListener('global:cache-reset', handler);
    return () => window.removeEventListener('global:cache-reset', handler);
  }, [filterType]);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      await runWithLoader(async () => {
        const params = {};
        
        // Handle type filter
        if (filterType && filterType !== 'all' && filterType !== 'suspended') {
          params.type = filterType;
        }
        
        // Handle suspended filter
        if (filterType === 'suspended') {
          params.status = 'suspended';
        }
        
        const response = await organizationService.getAll(params);
        // API returns { success: true, data: { organizations: [...], pagination: {...} } }
        const raw = response.data?.data?.organizations || response.data?.organizations || response.data || [];
        // Normalize backend keys (contact_email/contact_phone, zip_code) to frontend-friendly names
        const normalized = raw.map(org => ({
          ...org,
          // canonicalize code field from various backend shapes
          code: org.code || org.organization_code || org.org_code || org.organizationCode || null,
          phone: org.phone || org.contact_phone || org.contactPhone || null,
          email: org.email || org.contact_email || org.contactEmail || null,
          city: org.city || org.city_name || org.cityName || null,
          state: org.state || null,
          contactPerson: org.contact_person || org.contactPerson || null,
          // ensure type uses canonical uppercase values used by the UI
          type: (org.type || '').toString().toUpperCase(),
          // include pincode fallback used in existing DB rows
          zipCode: org.zipCode || org.postalCode || org.postal_code || org.zip_code || org.zip || org.pincode || null,
          // license might not exist in DB (legacy); keep it if present but don't display in form
          licenseNumber: org.licenseNumber || org.license_number || org.license || null
        }));

        // Ensure we expose explicit is_active flag to the UI for consistent status rendering
        normalized.forEach(o => {
          if (o.is_active === undefined) {
            // backend may use active/IsActive variants — fallbacks
            o.is_active = o.active !== undefined ? !!o.active : (o.isActive !== undefined ? !!o.isActive : (o.status ? (o.status.toString().toLowerCase() === 'active') : true));
          }
          // normalize status to lowercase string if present
          if (o.status) o.status = o.status.toString().toLowerCase();
        });

        setOrganizations(normalized);
      }, 'Loading organizations...');
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      setOrganizations([]);
      toast.error('Failed to load organizations. Please try again later.');
    } finally {
      setLoading(false);
      hideLoader();
    }
  };

  const handleOpenModal = (org = null) => {
    setSelectedOrg(org);
    if (org) {
      reset(org);
    } else {
      reset({});
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrg(null);
    reset({});
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // include legacy/canonical variants to ensure backend mapping works across schemas
      const payload = {
        ...data,
        // postal variants
        postalCode: data.zipCode,
        postal_code: data.zipCode,
        pincode: data.zipCode,
        // contact person variants
        contactPerson: data.contactPerson,
        contact_person: data.contactPerson,
        // contact variants
        contact_email: data.email,
        contactPhone: data.phone,
        contact_phone: data.phone,
        email: data.email,
        phone: data.phone,
      };

      if (selectedOrg) {
        await organizationService.update(selectedOrg.id, payload);
      } else {
        await organizationService.create(payload);
      }
      fetchOrganizations();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save organization:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Cannot perform the action right now. Please try again later.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this organization? This will disable all ambulances, suspend all users, cancel partnerships, and offboard all patients.')) {
      try {
        await organizationService.deactivate(id);
        toast.success('Organization deactivated successfully');
        fetchOrganizations();
      } catch (error) {
        console.error('Failed to deactivate organization:', error);
        const msg = error?.response?.data?.message || error?.message || 'Cannot perform the action right now. Please try again later.';
        toast.error(msg);
      }
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Activate this organization? This will re-enable approved ambulances and previously suspended users.')) return;
    try {
      await organizationService.activate(id);
      toast.success('Organization activated successfully');
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to activate organization:', error);
      const msg = error?.response?.data?.message || error?.message || 'Cannot perform the action right now. Please try again later.';
      toast.error(msg);
    }
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            {row.code && <p className="text-xs text-secondary">Code: {row.code}</p>}
          </div>
        </div>
      ),
    },
    {
      header: 'Code',
      accessor: 'code',
      render: (row) => (
        <div className="text-sm font-medium">{row.code || '-'}</div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          row.type === 'HOSPITAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
        }`}>
          {row.type}
        </span>
      ),
    },
    {
      header: 'Location',
      accessor: 'city',
      render: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-secondary" />
          <span>{row.city}, {row.state}</span>
        </div>
      ),
    },
    {
      header: 'Contact',
      accessor: 'phone',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-secondary" />
            <span>{row.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-secondary" />
            <span>{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        // Prefer explicit status; fall back to is_active flag to decide label
        (() => {
          const status = row.status ? row.status.toString().toLowerCase() : (row.is_active === false ? 'suspended' : 'active');
          const isActive = status === 'active';
          return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          );
        })()
      ),
    },
    {
      header: 'Actions',
      render: (row) => {
        const isSuspended = (row.status && row.status.toString().toLowerCase() === 'suspended') || row.is_active === false;
        return (
          <div className="flex items-center gap-2">
            {!isSuspended ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => handleOpenModal(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>
                  Deactivate
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={() => handleActivate(row.id)}>
                Activate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const filteredOrgs = organizations.filter(org => 
    org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold mt-5 mb-2">Organizations</h1>
          <p className="text-secondary">Manage hospitals and fleet owners</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          Add Organization
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-12"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-2xl font-medium transition-all ${
                filterType === 'all' ? 'bg-primary text-white' : 'bg-background-card'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('HOSPITAL')}
              className={`px-4 py-2 rounded-2xl font-medium transition-all ${
                filterType === 'HOSPITAL' ? 'bg-primary text-white' : 'bg-background-card'
              }`}
            >
              Hospitals
            </button>
            <button
              onClick={() => setFilterType('FLEET_OWNER')}
              className={`px-4 py-2 rounded-2xl font-medium transition-all ${
                filterType === 'FLEET_OWNER' ? 'bg-primary text-white' : 'bg-background-card'
              }`}
            >
              Fleets
            </button>
            <button
              onClick={() => setFilterType('suspended')}
              className={`px-4 py-2 rounded-2xl font-medium transition-all ${
                filterType === 'suspended' ? 'bg-primary text-white' : 'bg-background-card'
              }`}
            >
              Suspended
            </button>
          </div>
        </div>
      </Card>

      {/* Organizations Table */}
      <Table columns={columns} data={filteredOrgs} />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedOrg ? 'Edit Organization' : 'Add Organization'}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
              <Button loading={submitting} onClick={handleSubmit(onSubmit)}>
                {selectedOrg ? 'Update' : 'Create'}
              </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={<><span>Organization Name</span><span className="text-red-500"> *</span></>}
              {...register('name', { required: 'Name is required' })}
              error={errors.name?.message}
            />
            {/* Organization type is only selectable when creating a new organization. When editing, the type is immutable and hidden from the form. */}
            {!selectedOrg && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">Type <span className="text-red-500">*</span></label>
                <Controller
                  name="type"
                  control={control}
                  defaultValue={''}
                  rules={{ required: 'Type is required' }}
                  render={({ field }) => {
                    const options = [
                      { value: 'HOSPITAL', label: 'Hospital' },
                      { value: 'FLEET_OWNER', label: 'Fleet Owner' },
                    ];
                    const value = options.find((o) => o.value === field.value) || null;
                    return (
                      <Select
                        classNamePrefix="react-select"
                        options={options}
                        value={value}
                        onChange={(opt) => field.onChange(opt ? opt.value : '')}
                        placeholder="Select Type"
                      />
                    );
                  }}
                />
                {errors.type && <p className="mt-1 text-sm text-red-500">{errors.type.message}</p>}
              </div>
            )}
          </div>

          {/* License Number removed from form — DB doesn't have a stable column for it */}

          <Input
            label={<><span>Address</span></>}
            {...register('address')}
            error={errors.address?.message}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={<><span>City</span></>}
              {...register('city')}
              error={errors.city?.message}
            />
            <Input
              label={<><span>State</span></>}
              {...register('state')}
              error={errors.state?.message}
            />
            <Input
              label={<><span>Zip Code</span></>}
              {...register('zipCode')}
              error={errors.zipCode?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={<><span>Contact Person</span><span className="text-red-500"> *</span></>}
              {...register('contactPerson', { required: 'Contact person is required' })}
              error={errors.contactPerson?.message}
            />
            <Input
              label={<><span>Phone</span><span className="text-red-500"> *</span></>}
              type="tel"
              {...register('phone', { required: 'Phone is required' })}
              error={errors.phone?.message}
            />
            <Input
              label={<><span>Email</span><span className="text-red-500"> *</span></>}
              type="email"
              {...register('email', { required: 'Email is required' })}
              error={errors.email?.message}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
