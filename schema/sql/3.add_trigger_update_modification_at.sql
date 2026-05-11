CREATE FUNCTION sync_lastmod() RETURNS trigger AS $$
BEGIN
  NEW.modification_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


create trigger modification_at BEFORE UPDATE on real_estate FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();
  
create trigger modification_at BEFORE UPDATE on customers FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();
  
create trigger modification_at BEFORE UPDATE on customer_demands FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();
  
create trigger modification_at BEFORE UPDATE on sales FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();
  
create trigger modification_at BEFORE UPDATE on users FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();
  
create trigger modification_at BEFORE UPDATE on branches FOR EACH ROW EXECUTE PROCEDURE
  sync_lastmod();