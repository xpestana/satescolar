

# Plan: Insertar datos de prueba de pagos + becas

## Resumen

Insertar directamente en la base de datos (vía script SQL) datos de prueba para el colegio "Santo Domingo de Guzmán": 20 conceptos de pago, 3 planes (Regular, Beca 50%, Beca 100%), y 7 métodos de pago (uno por tipo). No se requieren cambios de esquema ya que las becas se modelan ajustando el `amount` en `payment_plan_concepts`.

## Datos a insertar

### 20 Conceptos de Pago

| # | Nombre | Tipo | Monto (VES) |
|---|--------|------|-------------|
| 1 | Inscripción | inscripcion | 150.00 |
| 2 | Reinscripción | inscripcion | 120.00 |
| 3 | Mensualidad Octubre | mensualidad | 80.00 |
| 4 | Mensualidad Noviembre | mensualidad | 80.00 |
| 5 | Mensualidad Diciembre | mensualidad | 80.00 |
| 6 | Mensualidad Enero | mensualidad | 80.00 |
| 7 | Mensualidad Febrero | mensualidad | 80.00 |
| 8 | Mensualidad Marzo | mensualidad | 80.00 |
| 9 | Mensualidad Abril | mensualidad | 80.00 |
| 10 | Mensualidad Mayo | mensualidad | 80.00 |
| 11 | Mensualidad Junio | mensualidad | 80.00 |
| 12 | Mensualidad Julio | mensualidad | 80.00 |
| 13 | Uniforme Escolar | uniforme | 45.00 |
| 14 | Uniforme Deportivo | uniforme | 35.00 |
| 15 | Transporte Ida y Vuelta | transporte | 60.00 |
| 16 | Transporte Solo Ida | transporte | 35.00 |
| 17 | Laboratorio de Ciencias | laboratorio | 25.00 |
| 18 | Laboratorio de Computación | laboratorio | 20.00 |
| 19 | Material Didáctico | otro | 30.00 |
| 20 | Seguro Estudiantil | otro | 15.00 |

### 3 Planes de Pago

1. **Plan Regular** - Todos los conceptos a precio completo
2. **Plan Beca 50%** - Mismos conceptos pero inscripción y mensualidades al 50%
3. **Plan Beca 100%** - Inscripción y mensualidades a 0 (beca total), otros conceptos se mantienen

### 7 Métodos de Pago (uno por tipo)

| Tipo | Etiqueta | Config |
|------|----------|--------|
| transferencia | Banesco Corriente | Banco 0134, cuenta ficticia |
| pago_movil | Pago Móvil BDV | Banco 0102, teléfono ficticio |
| zelle | Zelle Principal | correo ficticio |
| efectivo | Efectivo Caja | VES, USD |
| punto_venta | POS Banesco | Banco 0134 |
| tarjeta_debito | Débito Mercantil | Banco 0105 |
| tarjeta_credito | Crédito Provincial | Banco 0108 |

## Implementación

Un solo script SQL ejecutado con `psql` que:
1. Inserta los 20 conceptos y captura sus IDs con `RETURNING`
2. Inserta los 3 planes y captura sus IDs
3. Asocia conceptos a cada plan con montos ajustados según beca
4. Inserta los 7 métodos de pago con sus configs JSON

No se modifican archivos del proyecto. No se necesitan migraciones.

