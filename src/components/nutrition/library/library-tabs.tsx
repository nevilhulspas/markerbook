'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PencilIcon, Trash2Icon, PlusIcon } from 'lucide-react'

import { deleteCustomFood, deleteRecipe } from '@/actions/nutrition-library'
import type { RecipeWithIngredients } from '@/actions/nutrition-library'
import type { CustomFood } from '@/lib/database.types'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { CustomFoodForm } from './custom-food-form'
import { RecipeForm } from './recipe-form'

/** Deep-link payload parsed from the `?edit` query param.
 *  Format: `recipe:<id>` or `custom:<id>` */
export type InitialEdit =
  | { kind: 'recipe'; id: string }
  | { kind: 'custom'; id: string }
  | null

interface LibraryTabsProps {
  customFoods: CustomFood[]
  recipes: RecipeWithIngredients[]
  initialEdit?: InitialEdit
}

export function LibraryTabs({ customFoods, recipes, initialEdit }: LibraryTabsProps) {
  const [, startTransition] = useTransition()

  // Derive initial dialog state from deep-link param (server-side data available
  // at render time — no effect needed, avoiding the set-state-in-effect lint rule).
  const initialRecipe =
    initialEdit?.kind === 'recipe'
      ? recipes.find((r) => r.id === initialEdit.id)
      : undefined

  const initialCustomFood =
    initialEdit?.kind === 'custom'
      ? customFoods.find((f) => f.id === initialEdit.id)
      : undefined

  // Meals (recipes) dialog state
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(initialRecipe !== undefined)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithIngredients | undefined>(
    initialRecipe
  )

  // Custom food dialog state
  const [foodDialogOpen, setFoodDialogOpen] = useState(initialCustomFood !== undefined)
  const [editingFood, setEditingFood] = useState<CustomFood | undefined>(initialCustomFood)

  // Active tab — controlled so deep-link can switch tabs.
  const [activeTab, setActiveTab] = useState<string>(
    initialEdit?.kind === 'custom' ? 'custom-foods' : 'meals'
  )

  function openNewRecipe() {
    setEditingRecipe(undefined)
    setRecipeDialogOpen(true)
  }

  function openEditRecipe(r: RecipeWithIngredients) {
    setEditingRecipe(r)
    setRecipeDialogOpen(true)
  }

  function openNewFood() {
    setEditingFood(undefined)
    setFoodDialogOpen(true)
  }

  function openEditFood(f: CustomFood) {
    setEditingFood(f)
    setFoodDialogOpen(true)
  }

  function handleDeleteRecipe(id: string) {
    startTransition(async () => {
      const res = await deleteRecipe(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        // No router.refresh() needed — deleteRecipe revalidates /nutrition/library.
        toast.success('Meal deleted')
      }
    })
  }

  function handleDeleteFood(id: string) {
    startTransition(async () => {
      const res = await deleteCustomFood(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        // No router.refresh() needed — deleteCustomFood revalidates /nutrition/library.
        toast.success('Food deleted')
      }
    })
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="custom-foods">Custom foods</TabsTrigger>
        </TabsList>

        {/* ---- Meals tab ---- */}
        <TabsContent value="meals" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNewRecipe}>
              <PlusIcon className="size-4 mr-1" />
              New meal
            </Button>
          </div>
          {recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No meals yet. Create one to reuse across logs.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {recipes.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(r.total_kcal)} kcal · P&nbsp;{Math.round(r.total_protein)}g ·
                      C&nbsp;{Math.round(r.total_carbs)}g · F&nbsp;{Math.round(r.total_fat)}g
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground truncate">{r.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => openEditRecipe(r)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${r.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete meal?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{r.name}&rdquo; will be removed from your library. This cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteRecipe(r.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Custom foods tab ---- */}
        <TabsContent value="custom-foods" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNewFood}>
              <PlusIcon className="size-4 mr-1" />
              New food
            </Button>
          </div>
          {customFoods.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No custom foods yet. Add foods you eat regularly with custom macros.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {customFoods.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {f.name}
                      {f.brand && (
                        <span className="ml-1 text-muted-foreground font-normal">
                          — {f.brand}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.kcal_per_100g != null ? `${Math.round(f.kcal_per_100g)} kcal` : '—'} per
                      100g · default {f.default_grams}g
                    </p>
                    {f.notes && (
                      <p className="text-xs text-muted-foreground truncate">{f.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${f.name}`}
                    onClick={() => openEditFood(f)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${f.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete food?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{f.name}&rdquo; will be removed from your library. This cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteFood(f.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Meals dialog */}
      <Dialog open={recipeDialogOpen} onOpenChange={setRecipeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecipe ? 'Edit meal' : 'New meal'}</DialogTitle>
          </DialogHeader>
          <RecipeForm
            existing={editingRecipe}
            onClose={() => setRecipeDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Custom food dialog */}
      <Dialog open={foodDialogOpen} onOpenChange={setFoodDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFood ? 'Edit food' : 'New food'}</DialogTitle>
          </DialogHeader>
          <CustomFoodForm
            existing={editingFood}
            onClose={() => setFoodDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
