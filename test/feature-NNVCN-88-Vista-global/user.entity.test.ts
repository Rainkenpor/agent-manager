import { describe, it, expect } from 'vitest';
import {
	UserSchema,
	CreateUserSchema,
	UpdateUserSchema,
	LoginSchema,
} from '../../backend/src/domain/entities/user.entity.js';

describe('UserSchema', () => {
	const validUser = {
		id: '123e4567-e89b-12d3-a456-426614174000',
		email: 'test@example.com',
		username: 'testuser',
		password: 'hashedpassword123',
		active: true,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
	};

	it('should validate a valid user object', () => {
		const result = UserSchema.safeParse(validUser);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(validUser);
		}
	});

	it('should fail validation when email is invalid', () => {
		const invalidUser = { ...validUser, email: 'invalid-email' };
		const result = UserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('email');
		}
	});

	it('should fail validation when username is too short', () => {
		const invalidUser = { ...validUser, username: 'ab' };
		const result = UserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('username');
		}
	});

	it('should fail validation when password is missing', () => {
		const { password, ...invalidUser } = validUser;
		const result = UserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
	});

	it('should accept optional fields (firstName, lastName, lastLoginAt)', () => {
		const userWithOptionalFields = {
			...validUser,
			firstName: 'John',
			lastName: 'Doe',
			lastLoginAt: '2024-01-02T00:00:00.000Z',
		};
		const result = UserSchema.safeParse(userWithOptionalFields);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.firstName).toBe('John');
			expect(result.data.lastName).toBe('Doe');
			expect(result.data.lastLoginAt).toBe('2024-01-02T00:00:00.000Z');
		}
	});

	it('should validate active as boolean', () => {
		const userWithInactive = { ...validUser, active: false };
		const result = UserSchema.safeParse(userWithInactive);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.active).toBe(false);
		}

		const userWithInvalidActive = { ...validUser, active: 'yes' };
		const invalidResult = UserSchema.safeParse(userWithInvalidActive);
		expect(invalidResult.success).toBe(false);
	});

	it('should validate createdAt and updatedAt as strings', () => {
		const userWithStringDates = {
			...validUser,
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
		};
		const result = UserSchema.safeParse(userWithStringDates);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(typeof result.data.createdAt).toBe('string');
			expect(typeof result.data.updatedAt).toBe('string');
		}
	});
});

describe('CreateUserSchema', () => {
	const validCreateUser = {
		email: 'newuser@example.com',
		username: 'newuser',
		password: 'securepassword123',
	};

	it('should validate a valid create user object', () => {
		const result = CreateUserSchema.safeParse(validCreateUser);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(validCreateUser);
		}
	});

	it('should fail when email is invalid', () => {
		const invalidUser = { ...validCreateUser, email: 'not-an-email' };
		const result = CreateUserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('email');
		}
	});

	it('should fail when password is too short (less than 8 chars)', () => {
		const invalidUser = { ...validCreateUser, password: 'short' };
		const result = CreateUserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('password');
		}
	});

	it('should fail when username is too short (less than 3 chars)', () => {
		const invalidUser = { ...validCreateUser, username: 'ab' };
		const result = CreateUserSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('username');
		}
	});
});

describe('UpdateUserSchema', () => {
	it('should allow partial updates with optional fields', () => {
		const partialUpdate = {
			firstName: 'UpdatedName',
		};
		const result = UpdateUserSchema.safeParse(partialUpdate);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.firstName).toBe('UpdatedName');
		}
	});

	it('should validate email format when provided', () => {
		const updateWithInvalidEmail = {
			email: 'invalid-email',
		};
		const result = UpdateUserSchema.safeParse(updateWithInvalidEmail);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('email');
		}

		const updateWithValidEmail = {
			email: 'valid@example.com',
		};
		const validResult = UpdateUserSchema.safeParse(updateWithValidEmail);
		expect(validResult.success).toBe(true);
	});

	it('should validate password length when provided', () => {
		const updateWithShortPassword = {
			password: 'short',
		};
		const result = UpdateUserSchema.safeParse(updateWithShortPassword);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('password');
		}

		const updateWithValidPassword = {
			password: 'validpassword123',
		};
		const validResult = UpdateUserSchema.safeParse(updateWithValidPassword);
		expect(validResult.success).toBe(true);
	});
});

describe('LoginSchema', () => {
	const validLogin = {
		username: 'testuser',
		password: 'testpassword',
	};

	it('should validate a valid login object', () => {
		const result = LoginSchema.safeParse(validLogin);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(validLogin);
		}
	});

	it('should fail when username is missing', () => {
		const { username, ...invalidLogin } = validLogin;
		const result = LoginSchema.safeParse(invalidLogin);
		expect(result.success).toBe(false);
	});

	it('should fail when password is missing', () => {
		const { password, ...invalidLogin } = validLogin;
		const result = LoginSchema.safeParse(invalidLogin);
		expect(result.success).toBe(false);
	});
});