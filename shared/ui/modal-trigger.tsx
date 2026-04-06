"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

export function ModalTrigger(props: {
  buttonLabel: ReactNode;
  buttonClassName?: string;
  buttonAriaLabel?: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className={props.buttonClassName ?? "button subtle"}
        type="button"
        aria-label={props.buttonAriaLabel}
        onClick={() => dialogRef.current?.showModal()}
      >
        {props.buttonLabel}
      </button>
      <dialog className="modal" ref={dialogRef}>
        <div className="modal-card">
          <div className="modal-head">
            <h4>{props.title}</h4>
            <button className="button" type="button" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>
          {props.children}
        </div>
      </dialog>
    </>
  );
}
