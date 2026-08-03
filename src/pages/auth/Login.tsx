import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoleForRoute, role as roles } from "@/constants/role";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { AuthSplitLayout } from "@/layouts/AuthSplitLayout";
import { IconLock, IconMail, IconEye, IconEyeOff } from "@/components/auth/AuthIcons";
import "@/styles/auth.css";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

const DEMO_PASSWORD = "Excon@2026";
const DEMO_ACCOUNTS: { label: string; email: string }[] = [
  { label: "Super Admin", email: "superadmin@gmail.com" },
  { label: "Admin", email: "admin@example.com" },
  { label: "Teacher", email: "sarah.khan@ius.com" },
];

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });

  const fillDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true, shouldDirty: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true, shouldDirty: true });
    setShowPassword(true);
  };

  const onSubmit = handleSubmit(async (values: { email: string; password: string }) => {
    try {
      const user = await login({ email: values.email, password: values.password });
      toast.success("Signed in successfully.");
      if (normalizeRoleForRoute(user.role) === roles.teacher) navigate("/teacher", { replace: true });
      else if (normalizeRoleForRoute(user.role) === roles.superAdmin) navigate("/super-admin", { replace: true });
      else navigate("/admin", { replace: true });
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Login failed");
      setError("root", { message: msg });
      toast.error(msg);
    }
  });

  return (
    <AuthSplitLayout panelTitle="">
      <form onSubmit={onSubmit} noValidate>
        <h1 className="auth-split__heading">Welcome back!</h1>
        <p className="auth-split__sub">Sign in to your account to continue.</p>

        <label className="field">
          <span>Email</span>
          <div className="field-input">
            <span className="field-input__icon">
              <IconMail />
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Enter your email"
              {...register("email", { required: "Email is required." })}
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="field-input field-input--password">
            <span className="field-input__icon">
              <IconLock />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register("password", { required: "Password is required." })}
            />
            <button
              type="button"
              className="field-input__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </label>

        <div className="field-tools">
          <a href="#" className="auth__link" onClick={(e) => e.preventDefault()}>
            Forgot password?
          </a>
        </div>

        {errors.root?.message ? <div className="auth__error">{errors.root.message}</div> : null}

        <button className="btn auth__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="auth__demo">
          <span className="auth__demo-label">Demo accounts — auto-fill credentials</span>
          <div className="auth__demo-row">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="auth__demo-btn"
                onClick={() => fillDemo(a.email)}
                title={`${a.email} · ${DEMO_PASSWORD}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="auth__footer">
          <span>Don&apos;t have an account?</span> <Link to="/register">Sign up</Link>
        </div>
      </form>
    </AuthSplitLayout>
  );
}
