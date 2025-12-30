import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentAdmin } from '../auth/admin.decorator';
import { AdminProductsService } from './admin-products.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { AdminRole } from '@prisma/client';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Get()
  @Roles('READ_ONLY')
  listProducts() {
    return this.productsService.listProducts();
  }

  @Get(':code')
  @Roles('READ_ONLY')
  getProduct(@Param('code') code: string) {
    return this.productsService.getProduct(code);
  }

  @Patch(':code')
  @Roles('ADMIN')
  updateProduct(
    @Param('code') code: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.productsService.updateProduct(
      code,
      {
        title: dto.title,
        starsPrice: dto.starsPrice,
        durationDays: dto.durationDays,
        active: dto.active,
        priceBySettlementCurrency: dto.priceBySettlementCurrency,
      },
      admin,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':code/pricing')
  @Roles('ADMIN')
  updatePricing(
    @Param('code') code: string,
    @Body() dto: UpdatePricingDto,
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.productsService.updateProductPricing(
      code,
      {
        globalDiscountType: dto.globalDiscountType as any,
        percentOff: dto.percentOff,
        starsPriceOverride: dto.starsPriceOverride,
        priceBySettlementCurrencyOverride: dto.priceBySettlementCurrencyOverride,
        enabled: dto.enabled,
      },
      admin,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':code/promo-codes')
  @Roles('ADMIN')
  createPromoCode(
    @Param('code') productCode: string,
    @Body() dto: CreatePromoDto,
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.productsService.createPromoCode(
      {
        code: dto.code,
        productCode,
        discountType: dto.discountType as any,
        percentOff: dto.percentOff,
        starsPriceOverride: dto.starsPriceOverride,
        priceBySettlementCurrencyOverride: dto.priceBySettlementCurrencyOverride,
        enabled: dto.enabled,
        maxRedemptions: dto.maxRedemptions,
      },
      admin,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }
}

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/promo-codes')
export class AdminPromoCodesController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Patch(':id')
  @Roles('ADMIN')
  updatePromoCode(
    @Param('id') id: string,
    @Body() dto: UpdatePromoDto,
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.productsService.updatePromoCode(
      id,
      {
        enabled: dto.enabled,
        percentOff: dto.percentOff,
        starsPriceOverride: dto.starsPriceOverride,
        priceBySettlementCurrencyOverride: dto.priceBySettlementCurrencyOverride,
        maxRedemptions: dto.maxRedemptions,
      },
      admin,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  deletePromoCode(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.productsService.deletePromoCode(
      id,
      admin,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }
}









