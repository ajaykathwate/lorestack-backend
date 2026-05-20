import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value instanceof Date && value > new Date();
  }

  defaultMessage(_args: ValidationArguments): string {
    return '$property must be a future date';
  }
}

export function IsFutureDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}
