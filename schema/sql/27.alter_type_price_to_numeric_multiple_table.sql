-- Table SALES

ALTER TABLE sales ALTER COLUMN sell_price_from TYPE numeric(8,2);
ALTER TABLE sales ALTER COLUMN sell_price_to TYPE numeric(8,2);
ALTER TABLE sales ALTER COLUMN rent_price_from TYPE numeric(8,2);
ALTER TABLE sales ALTER COLUMN rent_price_to TYPE numeric(8,2);

-- Table REAL_ESTATE

ALTER TABLE real_estate ALTER COLUMN price TYPE numeric(8,2);
ALTER TABLE real_estate ALTER COLUMN brokerage_fees TYPE numeric(8,2);

-- Customer DEMAND

ALTER TABLE customer_demands ALTER COLUMN price_from TYPE numeric(8,2);
ALTER TABLE customer_demands ALTER COLUMN price_to TYPE numeric(8,2);

