import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createMockAppService } from './test/mocks/service-mocks';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    appService = createMockAppService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: appService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /', () => {
    describe('Success Cases', () => {
      it('should return welcome message', () => {
        appService.getHello.mockReturnValue('Hello World!');

        const result = controller.getHello();

        expect(result).toBe('Hello World!');
        expect(appService.getHello).toHaveBeenCalledTimes(1);
        expect(typeof result).toBe('string');
      });

      it('should handle multiple calls consistently', () => {
        appService.getHello.mockReturnValue('Hello World!');

        const result1 = controller.getHello();
        const result2 = controller.getHello();

        expect(result1).toBe(result2);
        expect(appService.getHello).toHaveBeenCalledTimes(2);
      });
    });
  });
});
