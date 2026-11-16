import { Alert, Snackbar } from "@mui/material";
import { AppShell } from "./components/AppShell";
import { LegacyImportDialog } from "./components/LegacyImportDialog";
import { CollectionPage } from "./pages/CollectionPage";
import { useUiStore } from "./stores/ui";

export default function App(): JSX.Element {
  const toast = useUiStore((state) => state.toast);
  const clearToast = useUiStore((state) => state.clearToast);

  return (
    <>
      <AppShell>
        <CollectionPage />
      </AppShell>
      <LegacyImportDialog />
      <Snackbar
        key={toast ? `${toast.severity}-${toast.message}` : "empty"}
        open={Boolean(toast)}
        autoHideDuration={4200}
        onClose={clearToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          onClose={clearToast}
          severity={toast?.severity ?? "info"}
          variant="filled"
          sx={{ maxWidth: 480 }}
        >
          {toast?.message ?? ""}
        </Alert>
      </Snackbar>
    </>
  );
}
