import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';

interface PrismaMock {
  utilisateur: { count: jest.Mock };
  messageInterne: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
}

const MESSAGE_ROW = {
  id: 'msg-1',
  expediteurId: 'user-1',
  contenu: 'Bonjour',
  date: new Date(),
  createdAt: new Date(),
  expediteur: { nom: 'Bah', prenom: 'Mamadou' },
  destinataires: [{ id: 'user-2', nom: 'Diallo', prenom: 'Fatou' }],
};

describe('MessageService', () => {
  let service: MessageService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      utilisateur: { count: jest.fn().mockResolvedValue(1) },
      messageInterne: {
        create: jest.fn().mockResolvedValue(MESSAGE_ROW),
        findMany: jest.fn().mockResolvedValue([MESSAGE_ROW]),
        findUnique: jest.fn().mockResolvedValue(MESSAGE_ROW),
      },
    };
    service = new MessageService(prisma as never);
  });

  describe('create', () => {
    it('destinataire introuvable → NotFoundException', async () => {
      prisma.utilisateur.count.mockResolvedValue(0);
      await expect(
        service.create({ destinataireIds: ['user-2'], contenu: 'Bonjour' }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('création réussie', async () => {
      const result = await service.create({ destinataireIds: ['user-2'], contenu: 'Bonjour' }, 'user-1');
      expect(result.id).toBe('msg-1');
      expect(prisma.messageInterne.create).toHaveBeenCalledWith({
        data: {
          expediteurId: 'user-1',
          contenu: 'Bonjour',
          destinataires: { connect: [{ id: 'user-2' }] },
        },
        select: expect.anything(),
      });
    });
  });

  describe('findRecus / findEnvoyes', () => {
    it('findRecus filtre sur les destinataires', async () => {
      await service.findRecus('user-2');
      expect(prisma.messageInterne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinataires: { some: { id: 'user-2' } } } }),
      );
    });

    it('findEnvoyes filtre sur l’expéditeur', async () => {
      await service.findEnvoyes('user-1');
      expect(prisma.messageInterne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { expediteurId: 'user-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('introuvable → NotFoundException', async () => {
      prisma.messageInterne.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ni expéditeur ni destinataire → ForbiddenException', async () => {
      await expect(service.findOne('msg-1', 'user-tiers')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('destinataire → accès autorisé', async () => {
      const result = await service.findOne('msg-1', 'user-2');
      expect(result.id).toBe('msg-1');
    });

    it('expéditeur → accès autorisé', async () => {
      const result = await service.findOne('msg-1', 'user-1');
      expect(result.id).toBe('msg-1');
    });
  });
});
