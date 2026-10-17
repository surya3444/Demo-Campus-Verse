import { Request, Response, NextFunction } from 'express';
import { infrastructureService } from './infrastructure.service';
import { success, created } from '../../utils/response';

class InfrastructureController {
  // ============ Buildings ============

  async createBuilding(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'X-Branch-Id header is required' },
        });
      }

      const building = await infrastructureService.createBuilding(
        req.tenantId,
        branchId,
        req.body,
        req.user?.userId
      );

      created(res, building, 'Building created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findAllBuildings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'X-Branch-Id header is required' },
        });
      }

      const result = await infrastructureService.findAllBuildings(
        req.tenantId,
        branchId,
        req.query as Record<string, unknown>
      );

      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async findBuildingById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const building = await infrastructureService.findBuildingById(
        req.tenantId,
        req.params.id as string
      );

      success(res, building);
    } catch (error) {
      next(error);
    }
  }

  async updateBuilding(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const building = await infrastructureService.updateBuilding(
        req.tenantId,
        req.params.id as string,
        req.body,
        req.user?.userId
      );

      success(res, building);
    } catch (error) {
      next(error);
    }
  }

  async deleteBuilding(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      await infrastructureService.deleteBuilding(req.tenantId, req.params.id as string);

      res.json({ success: true, message: 'Building deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ============ Floors ============

  async addFloor(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const building = await infrastructureService.addFloor(
        req.tenantId,
        req.params.id as string,
        req.body
      );

      success(res, building);
    } catch (error) {
      next(error);
    }
  }

  async updateFloor(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const building = await infrastructureService.updateFloor(
        req.tenantId,
        req.params.id as string,
        req.params.floorId as string,
        req.body
      );

      success(res, building);
    } catch (error) {
      next(error);
    }
  }

  async removeFloor(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const building = await infrastructureService.removeFloor(
        req.tenantId,
        req.params.id as string,
        req.params.floorId as string
      );

      success(res, building);
    } catch (error) {
      next(error);
    }
  }

  // ============ Rooms ============

  async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'X-Branch-Id header is required' },
        });
      }

      const room = await infrastructureService.createRoom(
        req.tenantId,
        branchId,
        req.body,
        req.user?.userId
      );

      created(res, room, 'Room created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findAllRooms(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'X-Branch-Id header is required' },
        });
      }

      const result = await infrastructureService.findAllRooms(
        req.tenantId,
        branchId,
        req.query as Record<string, unknown>
      );

      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async findRoomById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const room = await infrastructureService.findRoomById(req.tenantId, req.params.id as string);

      success(res, room);
    } catch (error) {
      next(error);
    }
  }

  async updateRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const room = await infrastructureService.updateRoom(
        req.tenantId,
        req.params.id as string,
        req.body,
        req.user?.userId
      );

      success(res, room);
    } catch (error) {
      next(error);
    }
  }

  async deleteRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      await infrastructureService.deleteRoom(req.tenantId, req.params.id as string);

      res.json({ success: true, message: 'Room deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ============ Stats ============

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'X-Branch-Id header is required' },
        });
      }

      const stats = await infrastructureService.getStats(req.tenantId, branchId);

      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const infrastructureController = new InfrastructureController();
