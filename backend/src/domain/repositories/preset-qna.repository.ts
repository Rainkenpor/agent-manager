import type { CreatePresetQnaDTO, PresetQnaRecord, UpdatePresetQnaDTO } from '../entities/preset-qna.entity.js'

export interface IPresetQnaRepository {
	create(data: CreatePresetQnaDTO): Promise<PresetQnaRecord>
	findAll(): Promise<PresetQnaRecord[]>
	findAllActive(): Promise<PresetQnaRecord[]>
	findById(id: string): Promise<PresetQnaRecord | undefined>
	update(data: UpdatePresetQnaDTO): Promise<PresetQnaRecord | undefined>
	delete(id: string): Promise<boolean>
}
