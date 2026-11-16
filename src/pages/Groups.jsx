import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { errorInfo, useGroupMutations, useGroups } from "@/api";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  ModalFooter,
  PageHeader,
  Skeleton,
} from "@/ui";

function GroupDialog({ group, onClose }) {
  const { save } = useGroupMutations();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { name: group?.name ?? "", description: group?.description ?? "" } });

  const onSubmit = handleSubmit(async ({ name, description }) => {
    try {
      await save.mutateAsync({ id: group?.id, name: name.trim(), description: description.trim() });
      toast.success(group ? "Group updated" : `${name.trim()} created`);
      onClose();
    } catch (err) {
      const { status, message } = errorInfo(err);
      if (status === 409) setError("name", { message: "A group with this name already exists" });
      else toast.error(message);
    }
  });

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={group ? "Edit group" : "New user group"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Name" htmlFor="group-name" error={errors.name?.message}>
          <Input
            id="group-name"
            autoFocus
            placeholder="QA Team"
            aria-invalid={!!errors.name}
            {...register("name", {
              validate: (v) => !!v.trim() || "Name is required",
              maxLength: { value: 60, message: "Keep it under 60 characters" },
            })}
          />
        </Field>

        <Field label="Description" htmlFor="group-desc">
          <Input id="group-desc" placeholder="Quality assurance team" {...register("description")} />
        </Field>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {group ? "Save" : "Create group"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default function GroupsPage() {
  const { data: groups, isLoading, error, refetch, isRefetching } = useGroups();
  const { remove } = useGroupMutations();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const newButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus />
      New group
    </Button>
  );

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} deleted`);
        setDeleting(null);
      },
      onError: (err) => toast.error(errorInfo(err).message),
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="User groups" actions={!!groups?.length && newButton}>
        Roll flags out to specific groups from a flag's Configure screen.
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorInfo(error).message} onRetry={refetch} retrying={isRefetching} />
      ) : !groups?.length ? (
        <EmptyState
          icon={<Users />}
          title="No user groups yet"
          text="Create groups like Dev Team or QA Team, then roll flags out to just those groups."
          action={newButton}
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-4 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{g.name}</div>
                {g.description && <div className="truncate text-xs text-slate-500">{g.description}</div>}
              </div>
              <span className="hidden font-mono text-[11px] text-slate-400 lg:block">{g.id}</span>
              <Menu modal={false}>
                <MenuTrigger
                  aria-label={`Actions for ${g.name}`}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem onSelect={() => setEditing(g)}>
                    <Pencil />
                    Edit
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem danger onSelect={() => setDeleting(g)}>
                    <Trash2 />
                    Delete
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
      )}

      {editing && <GroupDialog group={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "group"}?`}
        description="The group is archived. Its rollout rules stop applying and it falls back to each flag's default value."
        actionLabel="Delete group"
        danger
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}