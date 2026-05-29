// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { AxiosError } from "axios";
import api from "../../services/api";
import type {
  AuthState,
  LoginCredentials,
  RegisterForm,
  User,
} from "../../types";

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds: LoginCredentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login/", creds);
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Fusionner le panier local avec le serveur après login
      // const dispatch = useAppDispatch();
      // await dispatch(mergeLocalCartToServer());

      return data;
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        return rejectWithValue(
          err.response?.data || { detail: "Erreur de connexion" },
        );
      }
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (form: RegisterForm, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/register/", form);
      localStorage.setItem("access", data.tokens.access);
      localStorage.setItem("refresh", data.tokens.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data;
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        // Access the properties of AxiosError here
        return rejectWithValue(err.response?.data);

        // ...
      } else {
        // Handle other types of errors
      }
    }
  },
);

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem("user") || "null") as User | null,
  isAuthenticated: !!localStorage.getItem("access"),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    const pending = (s: AuthState) => {
      s.loading = true;
      s.error = null;
    };
    const rejected = (s: AuthState, a: PayloadAction<unknown>) => {
      s.loading = false;
      s.error = a.payload as AuthState["error"];
    };
    const fulfilled = (
      s: AuthState,
      a: PayloadAction<{ user: User; access: string; refresh: string }>,
    ) => {
      s.loading = false;
      s.isAuthenticated = true;
      s.user = a.payload.user;
    };
    b.addCase(loginUser.pending, pending);
    b.addCase(loginUser.fulfilled, fulfilled);
    b.addCase(loginUser.rejected, rejected);
    b.addCase(registerUser.pending, pending);
    b.addCase(registerUser.fulfilled, fulfilled);
    b.addCase(registerUser.rejected, rejected);
  },
});

export const requestResetCode = createAsyncThunk(
  "auth/requestResetCode",
  async (email: string, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/request-code/", { email });
      return data;
    } catch (err) {
      if (err instanceof AxiosError) {
        return rejectWithValue(err.response?.data);
      }
    }
  },
);

export const verifyResetCode = createAsyncThunk(
  "auth/verifyCode",
  async (payload: { email: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/verify-code/", payload);

      return data;
    } catch (err) {
      if (err instanceof AxiosError) {
        return rejectWithValue(err.response?.data);
      }
    }
  },
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (
    payload: { email: string; new_password: string; confirm_password: string },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post("/auth/reset-password/", payload);

      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      return data;
    } catch (err) {
      if (err instanceof AxiosError) {
        return rejectWithValue(err.response?.data);
      }
    }
  },
);

export const { logout, clearError } = authSlice.actions;
export const selectUser = (s: { auth: AuthState }) => s.auth.user;
export const selectIsAuthenticated = (s: { auth: AuthState }) =>
  s.auth.isAuthenticated;
export const selectIsAdmin = (s: { auth: AuthState }) =>
  s.auth.user?.role === "ADMIN";
export const selectAuthLoading = (s: { auth: AuthState }) => s.auth.loading;
export const selectAuthError = (s: { auth: AuthState }) => s.auth.error;
export default authSlice.reducer;
