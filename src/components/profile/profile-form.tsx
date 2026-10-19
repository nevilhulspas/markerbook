'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateProfile } from '@/actions/profile'
import {
  profileSchema,
  type ProfileFormValues,
} from '@/lib/validations/profile'
import type { ClientProfile } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProfileFormProps {
  initialData: ClientProfile | null
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: initialData?.display_name ?? '',
      date_of_birth: initialData?.date_of_birth ?? undefined,
      sex: initialData?.sex ?? undefined,
      height_cm: initialData?.height_cm ?? undefined,
      weight_kg: initialData?.weight_kg ?? undefined,
      activity_level: initialData?.activity_level ?? undefined,
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    setServerError(null)

    // Strip NaN values from empty number inputs
    const cleanedValues = {
      ...values,
      // Empty string clears the name (stored as null).
      display_name: values.display_name?.trim() || null,
      height_cm:
        values.height_cm != null && !Number.isNaN(values.height_cm)
          ? values.height_cm
          : undefined,
      weight_kg:
        values.weight_kg != null && !Number.isNaN(values.weight_kg)
          ? values.weight_kg
          : undefined,
    }

    const result = await updateProfile(cleanedValues)
    if (result.success) {
      toast.success('Profile updated successfully')
    } else {
      setServerError(result.error)
      toast.error('Failed to update profile')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
          Update your health details. All fields are optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="display_name">Name</Label>
              <Input
                id="display_name"
                placeholder="e.g. Alex"
                {...register('display_name')}
              />
              {errors.display_name && (
                <p className="text-sm text-destructive">
                  {errors.display_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...register('date_of_birth')}
              />
              {errors.date_of_birth && (
                <p className="text-sm text-destructive">
                  {errors.date_of_birth.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select
                defaultValue={initialData?.sex ?? undefined}
                onValueChange={(value) =>
                  setValue('sex', value as 'male' | 'female' | 'other')
                }
              >
                <SelectTrigger id="sex" className="w-full">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.sex && (
                <p className="text-sm text-destructive">
                  {errors.sex.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="height_cm">Height (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                step="0.1"
                placeholder="e.g. 175"
                {...register('height_cm', { valueAsNumber: true })}
              />
              {errors.height_cm && (
                <p className="text-sm text-destructive">
                  {errors.height_cm.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight_kg">Weight (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                placeholder="e.g. 70"
                {...register('weight_kg', { valueAsNumber: true })}
              />
              {errors.weight_kg && (
                <p className="text-sm text-destructive">
                  {errors.weight_kg.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="activity_level">Activity level</Label>
              <Select
                defaultValue={initialData?.activity_level ?? undefined}
                onValueChange={(value) =>
                  setValue(
                    'activity_level',
                    value as ProfileFormValues['activity_level']
                  )
                }
              >
                <SelectTrigger id="activity_level" className="w-full">
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="light">Lightly Active</SelectItem>
                  <SelectItem value="moderate">Moderately Active</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="very_active">Very Active</SelectItem>
                </SelectContent>
              </Select>
              {errors.activity_level && (
                <p className="text-sm text-destructive">
                  {errors.activity_level.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Save Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
