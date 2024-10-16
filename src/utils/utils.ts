import { Effect, Ref } from "effect";

export class ShutdownFlag {
  set: Effect.Effect<void>;
  get: Effect.Effect<boolean>;

  constructor(private value: Ref.Ref<boolean>) {
    this.set = Ref.update(this.value, () => true);
    this.get = Ref.get(this.value);
  }
}

export const makeSdFlag = Effect.andThen(
  Ref.make(false),
  (value) => new ShutdownFlag(value),
);
