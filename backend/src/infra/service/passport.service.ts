import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import bcrypt from 'bcryptjs'
import type { IUserRepository } from '@domain/repositories/user.repository.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export function configurePassport(userRepository: IUserRepository) {
	// Estrategia Local (username + password)
	passport.use(
		new LocalStrategy(
			{
				usernameField: 'username',
				passwordField: 'password'
			},
			async (username: any, password: any, done: any) => {
				try {
					// Buscar usuario por username o email
					let user = await userRepository.findByUsername(username)
					if (!user) {
						user = await userRepository.findByEmail(username)
					}

					if (!user) {
						return done(null, false, {
							message: 'Usuario o contraseña incorrectos'
						})
					}

					if (!user.active) {
						return done(null, false, { message: 'Usuario inactivo' })
					}

					// Verificar contraseña
					const isValidPassword = await bcrypt.compare(password, user.password)
					if (!isValidPassword) {
						return done(null, false, {
							message: 'Usuario o contraseña incorrectos'
						})
					}

					// Actualizar último login
					await userRepository.updateLastLogin(user.id)

					return done(null, user)
				} catch (error) {
					return done(error)
				}
			}
		)
	)

	// Estrategia JWT
	passport.use(
		new JwtStrategy(
			{
				jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
				secretOrKey: JWT_SECRET
			},
			async (payload: any, done: any) => {
				try {
					const user = await userRepository.findById(payload.sub)

					if (!user) {
						return done(null, false)
					}

					if (!user.active) {
						return done(null, false)
					}

					return done(null, user)
				} catch (error) {
					return done(error)
				}
			}
		)
	)
}

export { JWT_SECRET }
