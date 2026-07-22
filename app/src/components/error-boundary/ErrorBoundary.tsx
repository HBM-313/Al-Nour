/**
 * ErrorBoundary — fanger render-fejl så et barn aldrig møder en hvid,
 * død skærm. Wrap hele appen ÉN gang (scope="app") og hvert spil FOR SIG
 * (scope="game") inde i LessonScreen, så én spilfejl ikke dræber skallen.
 *
 * MUREN: rører kun error_log (ingen persondata-kolonner) via reportError —
 * se lib/errorLog.ts for dataminimerings-hvidlisten og fail-soft-kravet.
 */

import { Component, type ReactNode } from "react";
import type { AgeSkin } from "@/lib/types";
import { reportError } from "@/lib/errorLog";
import { ErrorScreen } from "./ErrorScreen";

export interface ErrorBoundaryProps {
  scope: "app" | "game";
  skin: AgeSkin;
  /** Komponent-navn til fejlloggen — vises ALDRIG for barnet. */
  component: string;
  /** Kun brugt når scope="game": forlad spillet/lektionen (tilbage til kortet). */
  onExit?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    void reportError({
      message: error.message,
      component: this.props.component,
      ageSkin: this.props.skin,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          scope={this.props.scope}
          skin={this.props.skin}
          onRetry={this.handleRetry}
          onExit={this.props.scope === "game" ? this.props.onExit : undefined}
        />
      );
    }
    return this.props.children;
  }
}
