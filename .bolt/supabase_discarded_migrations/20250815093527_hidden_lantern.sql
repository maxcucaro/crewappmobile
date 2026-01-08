@@ .. @@
 -- Politiche RLS per warehouse_checkins con company_id
 CREATE POLICY "Companies can manage own warehouse checkins"
   ON warehouse_checkins FOR ALL
-  USING (company_id = uid())
-  WITH CHECK (company_id = uid());
+  USING (company_id = auth.uid())
+  WITH CHECK (company_id = auth.uid());
 
 CREATE POLICY "Crew members can manage own checkins"
   ON warehouse_checkins FOR ALL
-  USING (crew_id = uid())
-  WITH CHECK (crew_id = uid());
+  USING (crew_id = auth.uid())
+  WITH CHECK (crew_id = auth.uid());